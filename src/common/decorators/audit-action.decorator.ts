import { SetMetadata } from '@nestjs/common';
import { AUDIT_ACTION_KEY } from '../constants/metadata.constants';

export interface AuditActionMetadata {
  /** Ej: 'USER_CREATED', 'KYC_APPROVED', 'WITHDRAWAL_APPROVED' */
  action: string;
  /** Ej: 'user', 'kyc', 'transaction' */
  resource: string;
}

/** Marca el handler para que AuditInterceptor registre la acción de forma inmutable. */
export const AuditAction = (action: string, resource: string) =>
  SetMetadata<string, AuditActionMetadata>(AUDIT_ACTION_KEY, {
    action,
    resource,
  });
