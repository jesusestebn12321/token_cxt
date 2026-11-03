import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Transacción interactiva de Prisma. El callback recibe el cliente de la
 * transacción; todas las escrituras financieras deben usarlo.
 */
export function runInTransaction<T>(
  prisma: PrismaService,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn);
}
