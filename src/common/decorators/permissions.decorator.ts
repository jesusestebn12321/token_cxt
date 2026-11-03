import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../constants/metadata.constants';
import { Permission } from '../enums/permission.enum';

/** El usuario debe tener TODOS los permisos indicados. */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
