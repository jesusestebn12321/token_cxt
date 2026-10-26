import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Connection } from 'mongoose';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /** Liveness: el proceso responde. */
  @Public()
  @SkipThrottle()
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness: además verifica la conexión a MongoDB (usado por el healthcheck de Docker). */
  @Public()
  @SkipThrottle()
  @Get()
  async ready() {
    try {
      await this.connection.db?.admin().ping();
      if (this.connection.readyState !== 1) throw new Error('not connected');
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
  }
}
