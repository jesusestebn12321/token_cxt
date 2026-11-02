import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { oid } from '@app/common/database/object-id';
import { DecideTransactionDto } from './dto/decide-transaction.dto';
import { ApprovalDecision, TransactionStatus } from './enums/transaction-status.enum';
import { TransactionType } from './enums/transaction-type.enum';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';

/**
 * Flujo maker-checker para dep�sitos y retiros (sin transacciones ni locks):
 *  - El voto se a�ade con un update at�mico condicionado a que la transacci�n siga
 *    PENDING_APPROVAL y a que el aprobador NO haya votado ya (`approvals.approverId $ne`).
 *  - Un solo RECHAZO rechaza la transacci�n; se necesitan `requiredApprovals` aprobaciones.
 *  - El cambio de estado final tambi�n es condicional (idempotente ante votos concurrentes).
 *
 * TODO: al pasar a APPROVED, publicar un evento para que el worker (a) acredite el
 * ledger en dep�sitos o (b) firme y emita el retiro on-chain v�a KMS/multisig.
 */
@Injectable()
export class ApprovalsService {
  constructor(@InjectModel(Transaction.name) private readonly model: Model<Transaction>) {}

  async decide(
    transactionId: string,
    dto: DecideTransactionDto,
    approverId: string,
  ): Promise<TransactionDocument> {
    if (dto.decision === ApprovalDecision.REJECTED && !dto.comment) {
      throw new BadRequestException('El comentario es obligatorio al rechazar');
    }

    const current = await this.model.findById(transactionId).select('type status');
    if (!current) throw new NotFoundException('Transacci�n no encontrada');
    if (current.type !== TransactionType.DEPOSIT && current.type !== TransactionType.WITHDRAWAL) {
      throw new BadRequestException('Solo dep�sitos y retiros requieren aprobaci�n manual');
    }

    const approver = oid(approverId);
    const voted = await this.model.findOneAndUpdate(
      {
        _id: transactionId,
        status: TransactionStatus.PENDING_APPROVAL,
        'approvals.approverId': { $ne: approver },
      },
      {
        $push: {
          approvals: {
            approverId: approver,
            decision: dto.decision,
            comment: dto.comment ?? null,
          },
        },
      },
      { returnDocument: 'after' },
    );
    if (!voted) {
      throw new ConflictException(
        `Ya registr� una decisi�n o la transacci�n ya no est� pendiente (estado: ${current.status})`,
      );
    }

    let nextStatus: TransactionStatus | null = null;
    if (dto.decision === ApprovalDecision.REJECTED) {
      nextStatus = TransactionStatus.REJECTED;
    } else {
      const approvals = voted.approvals.filter((a) => a.decision === ApprovalDecision.APPROVED).length;
      if (approvals >= voted.requiredApprovals) nextStatus = TransactionStatus.APPROVED;
    }
    if (!nextStatus) return voted;

    const finalized = await this.model.findOneAndUpdate(
      { _id: transactionId, status: TransactionStatus.PENDING_APPROVAL },
      {
        $set: {
          status: nextStatus,
          failureReason: nextStatus === TransactionStatus.REJECTED ? (dto.comment ?? null) : null,
        },
      },
      { returnDocument: 'after' },
    );
    return finalized ?? voted;
  }
}
