import { ClientSession, Connection } from 'mongoose';

/**
 * Ejecuta `fn` dentro de una transacción multi-documento de MongoDB.
 * REQUIERE un replica set (o Atlas). En un `mongod` standalone fallará.
 * Reintenta automáticamente ante errores transitorios (driver `withTransaction`).
 */
export async function runInTransaction<T>(
  connection: Connection,
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await connection.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
