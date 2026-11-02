import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import blockchainConfig from './config/blockchain.config';
import databaseConfig from './config/database.config';
import { validateEnv } from './config/env.validation';
import { TokensModule } from './modules/tokens/tokens.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: [databaseConfig, blockchainConfig],
      validate: validateEnv,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): MongooseModuleOptions =>
        config.getOrThrow<MongooseModuleOptions>('database'),
    }),
    TokensModule,
  ],
})
export class TokensAppModule {}
