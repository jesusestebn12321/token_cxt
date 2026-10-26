import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AmlResult } from '../enums/kyc-status.enum';
import { KycSubmission } from './kyc-submission.entity';

@Entity('aml_screenings')
export class AmlScreening extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  submissionId!: string;

  @ManyToOne(() => KycSubmission, (s) => s.screenings, { onDelete: 'CASCADE' })
  submission!: KycSubmission;

  /** Proveedor externo (Chainalysis, Sumsub, ComplyAdvantage...) */
  @Column({ type: 'varchar', length: 100 })
  provider!: string;

  @Column({ type: 'enum', enum: AmlResult })
  result!: AmlResult;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  matches!: Record<string, unknown>[];
}
