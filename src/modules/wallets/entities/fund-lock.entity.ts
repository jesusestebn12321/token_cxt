import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum FundLockReason {
  COMPLIANCE_HOLD = 'COMPLIANCE_HOLD',
  LEGAL_ORDER = 'LEGAL_ORDER',
  FRAUD_INVESTIGATION = 'FRAUD_INVESTIGATION',
  PENDING_WITHDRAWAL = 'PENDING_WITHDRAWAL',
  OTHER = 'OTHER',
}

@Entity('fund_locks')
export class FundLock extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  walletId!: string;

  @Column({ type: 'varchar', length: 20 })
  tokenSymbol!: string;

  @Column({ type: 'numeric', precision: 38, scale: 18 })
  amount!: string;

  @Column({ type: 'enum', enum: FundLockReason })
  reason!: FundLockReason;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid' })
  lockedBy!: string;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  releasedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  releasedBy!: string | null;
}
