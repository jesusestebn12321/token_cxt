import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_ACTION_KEY } from '../constants/metadata.constants';
import { AuditActionMetadata } from '../decorators/audit-action.decorator';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { AuditService } from '../../modules/audit/audit.service';

/**
 * Registra en el AuditLog toda ejecución exitosa de un handler marcado con
 * @AuditAction(). Si el handler falla no se registra como éxito.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditActionMetadata | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    return next.handle().pipe(
      tap((result: unknown) => {
        const resourceId =
          (req.params?.id as string | undefined) ??
          ((result as { id?: string } | null)?.id ?? null);

        this.auditService
          .append({
            actorId: req.user?.id ?? null,
            actorEmail: req.user?.email ?? null,
            action: meta.action,
            resource: meta.resource,
            resourceId,
            metadata: {
              method: req.method,
              path: req.originalUrl,
              params: req.params,
              // El body puede contener datos sensibles: nunca persistir campos secretos
              body: sanitize(req.body),
            },
            ipAddress: req.ip ?? null,
            userAgent: req.headers['user-agent'] ?? null,
          })
          .catch((error: unknown) =>
            this.logger.error('No se pudo registrar el evento de auditoría', error),
          );
      }),
    );
  }
}

const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'refreshToken', 'code', 'secret'];

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEYS.includes(k) ? '[REDACTED]' : sanitize(v),
      ]),
    );
  }
  return value;
}
