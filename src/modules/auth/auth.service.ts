import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { Permission } from '../../common/enums/permission.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuditService } from '../audit/audit.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshToken } from './entities/refresh-token.entity';
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
    @InjectRepository(RefreshToken) private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  // ── Login ──────────────────────────────────────────────────────
  async login(dto: LoginDto, ctx: RequestContext): Promise<LoginResult> {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);

    if (!user || !user.isActive) {
      await this.auditLogin('LOGIN_FAILED', null, dto.email, ctx, { reason: 'unknown_or_inactive' });
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (this.usersService.isLocked(user)) {
      await this.auditLogin('LOGIN_BLOCKED', user.id, user.email, ctx, { reason: 'locked' });
      throw new UnauthorizedException('Cuenta bloqueada temporalmente');
    }
    if (!(await this.usersService.verifyPassword(dto.password, user.passwordHash))) {
      await this.usersService.registerFailedLogin(user);
      await this.auditLogin('LOGIN_FAILED', user.id, user.email, ctx, { reason: 'bad_password' });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.twoFactorEnabled) {
      const twoFactorToken = await this.jwt.signAsync(
        { sub: user.id, type: '2fa' } satisfies TwoFactorPayload,
        this.signOptions('jwt.accessSecret', 'jwt.twoFactorExpiresIn'),
      );
      return { requiresTwoFactor: true, twoFactorToken };
    }

    await this.usersService.registerSuccessfulLogin(user.id);
    await this.auditLogin('LOGIN_SUCCESS', user.id, user.email, ctx, { twoFactor: false });
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
    if (!this.twoFactorService.verify(code, user.twoFactorSecret)) {
      await this.usersService.registerFailedLogin(user);
      await this.auditLogin('LOGIN_2FA_FAILED', user.id, user.email, ctx, {});
      throw new UnauthorizedException('Código 2FA inválido');
    }

    await this.usersService.registerSuccessfulLogin(user.id);
    await this.auditLogin('LOGIN_SUCCESS', user.id, user.email, ctx, { twoFactor: true });
    return this.issueTokens(user, true, ctx);
  }

  // ── Refresh / logout ───────────────────────────────────────────
  async refresh(refreshToken: string, ctx: RequestContext): Promise<TokenPair> {
    const payload = await this.verifyToken<RefreshPayload>(
      refreshToken,
      'jwt.refreshSecret',
      'refresh',
    );
    const stored = await this.refreshRepo.findOne({
      where: { tokenHash: this.hash(refreshToken) },
    });
    if (!stored) throw new UnauthorizedException('Refresh token desconocido');

    // Reutilización de un token ya rotado => posible robo: se revoca toda la familia
    if (stored.revokedAt) {
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token reutilizado; sesiones revocadas');
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    const user = await this.usersService.findByIdWithSecrets(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException('Usuario inactivo');

    stored.revokedAt = new Date();
    await this.refreshRepo.save(stored);
    return this.issueTokens(user, stored.twoFactorVerified, ctx);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshRepo.update(
      { tokenHash: this.hash(refreshToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // ── 2FA setup (usuario autenticado) ────────────────────────────
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

  // ── Internos ───────────────────────────────────────────────────
  private async issueTokens(
    user: User,
    twoFactorVerified: boolean,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    const roles = user.roles.map((r) => r.name as Role);
    const permissions = [
      ...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.code as Permission))),
    ];

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      type: 'access',
      roles,
      permissions,
      twoFactorVerified,
    };
    const accessToken = await this.jwt.signAsync(
      accessPayload,
      this.signOptions('jwt.accessSecret', 'jwt.accessExpiresIn'),
    );

    const refreshPayload: RefreshPayload = {
      sub: user.id,
      type: 'refresh',
      jti: randomUUID(),
      twoFactorVerified,
    };
    const refreshToken = await this.jwt.signAsync(
      refreshPayload,
      this.signOptions('jwt.refreshSecret', 'jwt.refreshExpiresIn'),
    );

    const { exp } = this.jwt.decode<{ exp: number }>(refreshToken);
    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        twoFactorVerified,
        expiresAt: new Date(exp * 1000),
        revokedAt: null,
        ipAddress: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      }),
    );

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
    return this.refreshRepo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
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
