import { Permission } from '../enums/permission.enum';
import { Role } from '../enums/role.enum';

export type JwtTokenType = 'access' | 'refresh' | '2fa';

export interface JwtPayload {
  sub: string;
  email: string;
  type: JwtTokenType;
  roles: Role[];
  permissions: Permission[];
  /** true cuando el usuario completó el segundo factor (o no lo tiene habilitado) */
  twoFactorVerified: boolean;
}

/** Usuario autenticado inyectado en `request.user` por JwtStrategy */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
  twoFactorVerified: boolean;
}
