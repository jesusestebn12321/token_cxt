import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError, mongo } from 'mongoose';

type MongoError = mongo.MongoServerError | MongooseError.CastError | MongooseError.ValidationError;

@Catch(mongo.MongoServerError, MongooseError.CastError, MongooseError.ValidationError)
export class MongoExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MongoExceptionFilter.name);

  catch(exception: MongoError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error de base de datos';

    if (exception instanceof mongo.MongoServerError) {
      if (exception.code === 11000) {
        status = HttpStatus.CONFLICT;
        message = 'Ya existe un registro con esos datos';
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    } else if (exception instanceof MongooseError.CastError) {
      status = HttpStatus.BAD_REQUEST;
      message = `Valor inválido para '${exception.path}'`;
    } else {
      status = HttpStatus.BAD_REQUEST;
      message = 'Datos inválidos';
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
