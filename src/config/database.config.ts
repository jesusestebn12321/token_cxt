import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? 'mongodb://root:root@localhost:27017/rwa_backoffice?authSource=admin&replicaSet=rs0',
}));
