import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/metadata.constants';

/** Excluye el endpoint de la autenticación JWT global. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
