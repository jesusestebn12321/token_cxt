import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';

// Config
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import blockchainConfig from './config/blockchain.config';
import { validateEnv } from './config/env.validation';

// Common (globales)
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { MongoExceptionFilter } from './common/filters/mongo-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

// Módulos de negocio
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { KycModule } from './modules/kyc/kyc.module';
import { TokensModule } from './modules/tokens/tokens.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // ── Configuración de entorno ────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: [appConfig, databaseConfig, jwtConfig, blockchainConfig],
      validate: validateEnv,
    }),

    // ── Base de datos: MongoDB vía Mongoose ─────────────────────
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): MongooseModuleOptions =>
        config.getOrThrow<MongooseModuleOptions>('database'),
    }),

    // ── Rate limiting global ────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>('app.throttle.ttl'),
          limit: config.getOrThrow<number>('app.throttle.limit'),
        },
      ],
    }),

    // ── Módulos de negocio ──────────────────────────────────────
    AuditModule, // @Global(): lo consumen AuditInterceptor y AuthService
    AuthModule,
    UsersModule,
    KycModule,
    TokensModule,
    WalletsModule,
    TransactionsModule,
    HealthModule,
  ],
  providers: [
    // Orden de guards: throttle → JWT → roles → permisos
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // respeta @Public()
    { provide: APP_GUARD, useClass: RolesGuard }, // @Roles()
    { provide: APP_GUARD, useClass: PermissionsGuard }, // @Permissions()

    // Interceptores globales
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }, // @AuditAction()
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

    // Filtros globales (el catch-all primero; los específicos después)
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: MongoExceptionFilter },
  ],
})
export class AppModule {}
