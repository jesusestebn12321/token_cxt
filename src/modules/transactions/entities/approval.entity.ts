import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ApprovalDecision } from '../enums/transaction-status.enum';
import { Transaction } from './transaction.entity';

@Entity('transaction_approvals')
@Index(['transactionId', 'approverId'], { unique: true }) // un voto por aprobador
export class Approval extends BaseEntity {
  @Column({ type: 'uuid' })
  transactionId!: string;

  @ManyToOne(() => Transaction, (t) => t.approvals, { onDelete: 'CASCADE' })
  transaction!: Transaction;

  /** Usuario del backoffice que decide */
  @Column({ type: 'uuid' })
  approverId!: string;

  @Column({ type: 'enum', enum: ApprovalDecision })
  decision!: ApprovalDecision;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;
}
