import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { oid } from '../../common/database/object-id';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuditService } from '../audit/audit.service';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshToken } from './schemas/refresh-token.schema';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly twoFactorService: TwoFactorService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @InjectModel(RefreshToken.name) private readonly refreshModel: Model<RefreshToken>,
  ) {}

  // -- Login ------------------------------------------------------
  async login(dto: LoginDto, ctx: RequestContext): Promise<LoginResult> {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);

    if (!user || !user.isActive) {
      await this.auditLogin('LOGIN_FAILED', null, dto.email, ctx, { reason: 'unknown_or_inactive' });
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const userId = user.id as string;

    if (this.usersService.isLocked(user)) {
      await this.auditLogin('LOGIN_BLOCKED', userId, user.email, ctx, { reason: 'locked' });
      throw new UnauthorizedException('Cuenta bloqueada temporalmente');
    }
    if (!(await this.usersService.verifyPassword(dto.password, user.passwordHash))) {
      await this.usersService.registerFailedLogin(user);
      await this.auditLogin('LOGIN_FAILED', userId, user.email, ctx, { reason: 'bad_password' });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.twoFactorEnabled) {
      const twoFactorToken = await this.jwt.signAsync(
        { sub: userId, type: '2fa' } satisfies TwoFactorPayload,
        this.signOptions('jwt.accessSecret', 'jwt.twoFactorExpiresIn'),
      );
      return { requiresTwoFactor: true, twoFactorToken };
    }

    await this.usersService.registerSuccessfulLogin(userId);
    await this.auditLogin('LOGIN_SUCCESS', userId, user.email, ctx, { twoFactor: false });
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
      throw new UnauthorizedException('Sesión inválida');
    }
    const userId = user.id as string;

    if (!this.twoFactorService.verify(code, user.twoFactorSecret)) {
      await this.usersService.registerFailedLogin(user);
      await this.auditLogin('LOGIN_2FA_FAILED', userId, user.email, ctx, {});
      throw new UnauthorizedException('Código 2FA inválido');
    }

    await this.usersService.registerSuccessfulLogin(userId);
    await this.auditLogin('LOGIN_SUCCESS', userId, user.email, ctx, { twoFactor: true });
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

    // Rotación atómica: solo UN request puede "consumir" el token (revokedAt: null ? fecha)
    const now = new Date();
    const consumed = await this.refreshModel.findOneAndUpdate(
      { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
      { $set: { revokedAt: now } },
      { returnDocument: 'before' },
    );

    if (!consumed) {
      const existing = await this.refreshModel.findOne({ tokenHash });
      // Reutilización de un token ya rotado => posible robo: se revoca toda la familia
      if (existing?.revokedAt) {
        await this.revokeAllForUser(existing.userId.toString());
        throw new UnauthorizedException('Refresh token reutilizado; sesiones revocadas');
      }
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.usersService.findByIdWithSecrets(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException('Usuario inactivo');

    return this.issueTokens(user, consumed.twoFactorVerified, ctx);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshModel.updateOne(
      { tokenHash: this.hash(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  // -- 2FA setup (usuario autenticado) ----------------------------
  async setupTwoFactor(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.usersService.findByIdWithSecrets(userId);
    if (!user) throw new UnauthorizedException();
    if (user.twoFactorEnabled) throw new BadRequestException('2FA ya está habilitado');

    const secret = this.twoFactorService.generateSecret();
    await this.usersService.setTwoFactor(userId, secret, false); // pendiente de confirmación
    return { secret, otpauthUrl: this.twoFactorService.buildOtpAuthUrl(user.email, secret) };
  }

  async enableTwoFactor(userId: string, code: string): Promise<{ enabled: true }> {
    const user = await this.usersService.findByIdWithSecrets(userId);
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('Primero inicie la configuración de 2FA');
    }
    if (!this.twoFactorService.verify(code, user.twoFactorSecret)) {
      throw new BadRequestException('Código 2FA inválido');
    }
    await this.usersService.setTwoFactor(userId, user.twoFactorSecret, true);
    await this.revokeAllForUser(userId); // fuerza re-login con segundo factor
    return { enabled: true };
  }

  // -- Internos ---------------------------------------------------
  private async issueTokens(
    user: UserDocument,
    twoFactorVerified: boolean,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    const userId = user.id as string;
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
    await this.refreshModel.create({
      userId: oid(userId),
      tokenHash: this.hash(refreshToken),
      twoFactorVerified,
      expiresAt: new Date(exp * 1000),
      revokedAt: null,
      ipAddress: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
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
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private signOptions(secretKey: string, expiresKey: string): JwtSignOptions {
    return {
      secret: this.config.getOrThrow<string>(secretKey),
      expiresIn: this.config.getOrThrow<string>(expiresKey) as JwtSignOptions['expiresIn'],
    };
  }

  private revokeAllForUser(userId: string) {
    return this.refreshModel.updateMany(
      { userId: oid(userId), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private auditLogin(
    action: string,
    actorId: string | null,
    email: string,
    ctx: RequestContext,
    metadata: Record<string, unknown>,
  ) {
    return this.audit
      .append({
        actorId,
        actorEmail: email,
        action,
        resource: 'auth',
        resourceId: actorId,
        metadata,
        ipAddress: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      })
      .catch(() => undefined);
  }
}
