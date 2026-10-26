import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../constants/metadata.constants';
import { Role } from '../enums/role.enum';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (!required || required.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (!user) throw new ForbiddenException('Acceso denegado');

    if (user.roles.includes(Role.SUPER_ADMIN)) return true;
    if (required.some((role) => user.roles.includes(role))) return true;

    throw new ForbiddenException('Rol insuficiente para esta operación');
  }
}
