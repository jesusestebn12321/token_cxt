import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import { Approval } from './approval.entity';

@Entity('transactions')
export class Transaction extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  customerId!: string;

  @Index()
  @Column({ type: 'uuid' })
  walletId!: string;

  @Index()
  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @Index()
  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING_APPROVAL })
  status!: TransactionStatus;

  @Column({ type: 'varchar', length: 20 })
  tokenSymbol!: string;

  @Column({ type: 'numeric', precision: 38, scale: 18 })
  amount!: string;

  @Column({ type: 'numeric', precision: 38, scale: 18, default: '0' })
  fee!: string;

  /** Dirección EVM destino (retiros) u origen (depósitos) */
  @Column({ type: 'varchar', length: 42, nullable: true })
  counterpartyAddress!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 66, nullable: true })
  txHash!: string | null;

  @Column({ type: 'int', nullable: true })
  chainId!: number | null;

  @Column({ type: 'smallint', default: 1 })
  requiredApprovals!: number;

  @Column({ type: 'smallint', default: 0 })
  riskScore!: number;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @OneToMany(() => Approval, (a) => a.transaction)
  approvals!: Approval[];
}
