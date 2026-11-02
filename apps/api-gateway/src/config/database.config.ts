import { registerAs } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';

export default registerAs(
  'database',
  (): MongooseModuleOptions => ({
    // Las transacciones (ledger, bloqueo de fondos) requieren replica set: ?replicaSet=rs0
    uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/rwa_backoffice?replicaSet=rs0',
    // En producción crear los índices con un despliegue controlado, no al arrancar
    autoIndex:
      process.env.MONGODB_AUTO_INDEX !== undefined
        ? process.env.MONGODB_AUTO_INDEX === 'true'
        : process.env.NODE_ENV !== 'production',
    serverSelectionTimeoutMS: 5_000,
    retryAttempts: 3,
    retryDelay: 3_000,
  }),
);
