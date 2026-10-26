import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = config.getOrThrow<number>('app.port');
  const env = config.getOrThrow<string>('app.env');
  const globalPrefix = config.getOrThrow<string>('app.globalPrefix');
  const corsOrigins = config.getOrThrow<string[]>('app.corsOrigins');
  const swaggerEnabled = config.get<boolean>('app.swagger.enabled') ?? false;

  // ── Seguridad ──────────────────────────────────────────────────
  app.use(helmet());
  app.set('trust proxy', 1); // IP real tras proxy/LB (importante para auditoría)
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── Prefijo y versionado: /api/v1/... ──────────────────────────
  app.setGlobalPrefix(globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── Validación global de DTOs ──────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // elimina propiedades no declaradas en el DTO
      forbidNonWhitelisted: true, // rechaza propiedades desconocidas
      transform: true, // class-transformer: payload → instancia del DTO
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false, value: false }, // no filtrar datos sensibles
    }),
  );

  // ── Swagger / OpenAPI (deshabilitado en producción por defecto) ─
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('RWA Exchange - Backoffice API')
      .setDescription('API administrativa del Exchange de Tokenización de Activos (RWA)')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('Auth')
      .addTag('Users')
      .addTag('KYC')
      .addTag('Tokens')
      .addTag('Wallets')
      .addTag('Transactions')
      .addTag('Audit')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger: http://localhost:${port}/${globalPrefix}/docs`);
  }

  // ── Cierre ordenado (conexiones DB, jobs, listeners EVM) ───────
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(`Backoffice [${env}] escuchando en el puerto ${port}`);
}

bootstrap().catch((err: unknown) => {
  new Logger('Bootstrap').error('Error fatal al iniciar la aplicación', err);
  process.exit(1);
});
