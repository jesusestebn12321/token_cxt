import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';

interface PgDriverError {
  code?: string;
  detail?: string;
}

@Catch(QueryFailedError, EntityNotFoundError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TypeOrmExceptionFilter.name);

  catch(exception: QueryFailedError | EntityNotFoundError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error de base de datos';

    if (exception instanceof EntityNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      message = 'Recurso no encontrado';
    } else {
      const code = (exception.driverError as PgDriverError | undefined)?.code;
      switch (code) {
        case '23505': // unique_violation
          status = HttpStatus.CONFLICT;
          message = 'Ya existe un registro con esos datos';
          break;
        case '23503': // foreign_key_violation
          status = HttpStatus.CONFLICT;
          message = 'Operación inválida por referencia a otro recurso';
          break;
        case '23502': // not_null_violation
        case '22P02': // invalid_text_representation (ej. uuid inválido)
          status = HttpStatus.BAD_REQUEST;
          message = 'Datos inválidos';
          break;
        default:
          this.logger.error(exception.message, exception.stack);
      }
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
