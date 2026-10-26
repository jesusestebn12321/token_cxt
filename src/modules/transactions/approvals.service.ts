import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DecideTransactionDto } from './dto/decide-transaction.dto';
import { Approval } from './entities/approval.entity';
import { Transaction } from './entities/transaction.entity';
import { ApprovalDecision, TransactionStatus } from './enums/transaction-status.enum';
import { TransactionType } from './enums/transaction-type.enum';

/**
 * Flujo maker-checker para depósitos y retiros:
 *  - Solo transacciones PENDING_APPROVAL pueden decidirse.
 *  - Un aprobador no puede votar dos veces (índice único en BD).
 *  - Un solo RECHAZO rechaza la transacción; se necesitan `requiredApprovals` aprobaciones.
 *
 * TODO: al pasar a APPROVED, publicar un evento para que el worker (a) acredite el
 * ledger en depósitos o (b) firme y emita el retiro on-chain vía KMS/multisig.
 */
@Injectable()
export class ApprovalsService {
  constructor(private readonly dataSource: DataSource) {}

  async decide(
    transactionId: string,
    dto: DecideTransactionDto,
    approverId: string,
  ): Promise<Transaction> {
    if (dto.decision === ApprovalDecision.REJECTED && !dto.comment) {
      throw new BadRequestException('El comentario es obligatorio al rechazar');
    }

    return this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(Transaction);
      const approvalRepo = manager.getRepository(Approval);

      const tx = await txRepo.findOne({
        where: { id: transactionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tx) throw new NotFoundException('Transacción no encontrada');

      if (tx.status !== TransactionStatus.PENDING_APPROVAL) {
        throw new ConflictException(`La transacción está en estado ${tx.status}`);
      }
      if (tx.type !== TransactionType.DEPOSIT && tx.type !== TransactionType.WITHDRAWAL) {
        throw new BadRequestException('Solo depósitos y retiros requieren aprobación manual');
      }
      if (await approvalRepo.exists({ where: { transactionId, approverId } })) {
        throw new ForbiddenException('Ya registró una decisión para esta transacción');
      }

      await approvalRepo.save(
        approvalRepo.create({
          transactionId,
          approverId,
          decision: dto.decision,
          comment: dto.comment ?? null,
        }),
      );

      if (dto.decision === ApprovalDecision.REJECTED) {
        tx.status = TransactionStatus.REJECTED;
        tx.failureReason = dto.comment ?? null;
      } else {
        const approvals = await approvalRepo.count({
          where: { transactionId, decision: ApprovalDecision.APPROVED },
        });
        if (approvals >= tx.requiredApprovals) tx.status = TransactionStatus.APPROVED;
      }
      return txRepo.save(tx);
    });
  }
}
