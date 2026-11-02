import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { TokensAppModule } from './tokens-app.module';

async function bootstrap(): Promise<void> {
  const host = process.env.TOKENS_SERVICE_HOST ?? '0.0.0.0';
  const port = Number(process.env.TOKENS_SERVICE_PORT ?? 3001);
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(TokensAppModule, {
    transport: Transport.TCP,
    options: { host, port },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false, value: false },
    }),
  );

  await app.listen();
  new Logger('TokensService').log(`Microservicio TCP escuchando en ${host}:${port}`);
}

bootstrap().catch((err: unknown) => {
  new Logger('TokensService').error('Error fatal al iniciar el microservicio', err);
  process.exit(1);
});
