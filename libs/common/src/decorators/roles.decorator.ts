import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/metadata.constants';
import { Role } from '../enums/role.enum';

/** El usuario debe tener AL MENOS uno de los roles indicados. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
