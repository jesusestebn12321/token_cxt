import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicUser, SecretUser, UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TwoFactorService } from './two-factor/two-factor.service';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type LoginResult =
  | ({ requiresTwoFactor: false } & TokenPair)
  | { requiresTwoFactor: true; twoFactorToken: string };

interface RefreshPayload {
  sub: string;
  type: 'refresh';
  jti: string;
  twoFactorVerified: boolean;
}

interface TwoFactorPayload {
  sub: string;
  type: '2fa';
}

const RESET_TTL_MS = 30 * 60 * 1000;

export interface ForgotPasswordResult {
  accepted: true;
  resetToken?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly twoFactorService: TwoFactorService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // -- Login ------------------------------------------------------
  async login(dto: LoginDto, ctx: RequestContext): Promise<LoginResult> {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inv�lidas');
    }
    const userId = user.id;

    if (this.usersService.isLocked(user)) {
      throw new UnauthorizedException('Cuenta bloqueada temporalmente');
    }
    if (!(await this.usersService.verifyPassword(dto.password, user.passwordHash))) {
      await this.usersService.registerFailedLogin(user);
      throw new UnauthorizedException('Credenciales inv�lidas');
    }

    if (user.twoFactorEnabled) {
      const twoFactorToken = await this.jwt.signAsync(
        { sub: userId, type: '2fa' } satisfies TwoFactorPayload,
        this.signOptions('jwt.accessSecret', 'jwt.twoFactorExpiresIn'),
      );
      return { requiresTwoFactor: true, twoFactorToken };
    }

    await this.usersService.registerSuccessfulLogin(userId);
    return { requiresTwoFactor: false, ...(await this.issueTokens(user, false, ctx)) };
  }

  async verifyTwoFactorLogin(
    twoFactorToken: string,
    code: string,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    const payload = await this.verifyToken<TwoFactorPayload>(
      twoFactorToken,
      'jwt.accessSecret',
      '2fa',
    );
    const user = await this.usersService.findByIdWithSecrets(payload.sub);
    if (!user || !user.isActive || !user.twoFactorSecret) {
      throw new UnauthorizedException('Sesi�n inv�lida');
    }
    const userId = user.id;

    if (!this.twoFactorService.verify(code, user.twoFactorSecret)) {
      await this.usersService.registerFailedLogin(user);
      throw new UnauthorizedException('C�digo 2FA inv�lido');
    }

    await this.usersService.registerSuccessfulLogin(userId);
    return this.issueTokens(user, true, ctx);
  }

  // -- Refresh / logout -------------------------------------------
  async refresh(refreshToken: string, ctx: RequestContext): Promise<TokenPair> {
    const payload = await this.verifyToken<RefreshPayload>(
      refreshToken,
      'jwt.refreshSecret',
      'refresh',
    );
    const tokenHash = this.hash(refreshToken);

    const now = new Date();
    const consumed = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (consumed.count !== 1 || !existing) {
      if (existing?.revokedAt && consumed.count === 0) {
        await this.revokeAllForUser(existing.userId);
        throw new UnauthorizedException('Refresh token reutilizado; sesiones revocadas');
      }
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.usersService.findByIdWithSecrets(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException('Usuario inactivo');

    return this.issueTokens(user, existing.twoFactorVerified, ctx);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async register(dto: RegisterDto): Promise<PublicUser> {
    return this.usersService.registerSelf(dto);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<ForgotPasswordResult> {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);
    if (!user || !user.isActive) return { accepted: true };

    const resetToken = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hash(resetToken),
          expiresAt: new Date(now.getTime() + RESET_TTL_MS),
        },
      });
    });

    if (this.config.get<boolean>('app.exposeResetToken') === true) {
      return { accepted: true, resetToken };
    }
    this.logger.warn(
      `Recuperación emitida para ${user.email} sin entrega por correo. Active AUTH_EXPOSE_RESET_TOKEN solo en local.`,
    );
    return { accepted: true };
  }

  async resetPassword(token: string, password: string): Promise<{ reset: true }> {
    const tokenHash = this.hash(token);
    const now = new Date();
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt <= now) {
      throw new BadRequestException('El enlace de recuperación no es válido o expiró');
    }

    const passwordHash = await this.usersService.hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.deleteMany({ where: { id: record.id } });
      if (consumed.count !== 1) {
        throw new BadRequestException('El enlace de recuperación no es válido o expiró');
      }
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
    return { reset: true };
  }

  // -- 2FA setup (usuario autenticado) ----------------------------
  async setupTwoFactor(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.usersService.findByIdWithSecrets(userId);
    if (!user) throw new UnauthorizedException();
    if (user.twoFactorEnabled) throw new BadRequestException('2FA ya est� habilitado');

    const secret = this.twoFactorService.generateSecret();
    await this.usersService.setTwoFactor(userId, secret, false); // pendiente de confirmaci�n
    return { secret, otpauthUrl: this.twoFactorService.buildOtpAuthUrl(user.email, secret) };
  }

  async enableTwoFactor(userId: string, code: string): Promise<{ enabled: true }> {
    const user = await this.usersService.findByIdWithSecrets(userId);
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('Primero inicie la configuraci�n de 2FA');
    }
    if (!this.twoFactorService.verify(code, user.twoFactorSecret)) {
      throw new BadRequestException('C�digo 2FA inv�lido');
    }
    await this.usersService.setTwoFactor(userId, user.twoFactorSecret, true);
    await this.revokeAllForUser(userId); // fuerza re-login con segundo factor
    return { enabled: true };
  }

  // -- Internos ---------------------------------------------------
  private async issueTokens(
    user: SecretUser,
    twoFactorVerified: boolean,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    const userId = user.id;
    const permissions = await this.usersService.resolvePermissions(user.roles);

    const accessPayload: JwtPayload = {
      sub: userId,
      email: user.email,
      type: 'access',
      roles: user.roles as Role[],
      permissions,
      twoFactorVerified,
    };
    const accessToken = await this.jwt.signAsync(
      accessPayload,
      this.signOptions('jwt.accessSecret', 'jwt.accessExpiresIn'),
    );

    const refreshPayload: RefreshPayload = {
      sub: userId,
      type: 'refresh',
      jti: randomUUID(),
      twoFactorVerified,
    };
    const refreshToken = await this.jwt.signAsync(
      refreshPayload,
      this.signOptions('jwt.refreshSecret', 'jwt.refreshExpiresIn'),
    );

    const { exp } = this.jwt.decode<{ exp: number }>(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(refreshToken),
        twoFactorVerified,
        expiresAt: new Date(exp * 1000),
        ipAddress: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });

    return { accessToken, refreshToken };
  }

  private async verifyToken<T extends { type: string }>(
    token: string,
    secretKey: string,
    expectedType: T['type'],
  ): Promise<T> {
    try {
      const payload = await this.jwt.verifyAsync<T>(token, {
        secret: this.config.getOrThrow<string>(secretKey),
      });
      if (payload.type !== expectedType) throw new Error('type mismatch');
      return payload;
    } catch {
      throw new UnauthorizedException('Token inv�lido o expirado');
    }
  }

  private signOptions(secretKey: string, expiresKey: string): JwtSignOptions {
    return {
      secret: this.config.getOrThrow<string>(secretKey),
      expiresIn: this.config.getOrThrow<string>(expiresKey) as JwtSignOptions['expiresIn'],
    };
  }

  private revokeAllForUser(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

}
