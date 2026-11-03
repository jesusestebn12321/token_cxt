import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Uso explícito con @UseGuards(TwoFactorGuard) en operaciones sensibles
 * (aprobar retiros, operar contratos, bloquear fondos...).
 * Exige que la sesión haya superado un TOTP; los usuarios sin 2FA quedan
 * bloqueados y deben activarlo primero.
 */
@Injectable()
export class TwoFactorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    if (!user?.twoFactorVerified) {
      throw new ForbiddenException(
        'Esta operación requiere autenticación de dos factores verificada',
      );
    }
    return true;
  }
}
