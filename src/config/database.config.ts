import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'rwa_backoffice',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    autoLoadEntities: true,
    // El esquema se gestiona SOLO con migraciones. Nunca activar synchronize.
    synchronize: false,
    migrationsRun: false,
    migrations: [join(__dirname, '..', 'database', 'migrations', '*{.ts,.js}')],
    logging: process.env.DB_LOGGING === 'true',
  }),
);
