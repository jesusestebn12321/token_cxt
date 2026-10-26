import 'dotenv/config';
import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';

/**
 * DataSource exclusivo para el CLI de TypeORM (migraciones).
 * La aplicación usa TypeOrmModule con database.config.ts.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'rwa_backoffice',
  entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  synchronize: false,
});
