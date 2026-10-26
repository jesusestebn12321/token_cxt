import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { KycLevel, KycStatus } from '../enums/kyc-status.enum';
import { AmlScreening } from './aml-screening.entity';
import { KycDocument } from './kyc-document.entity';

@Entity('kyc_submissions')
export class KycSubmission extends BaseEntity {
  /** Usuario final del exchange (no es un usuario de backoffice) */
  @Index()
  @Column({ type: 'uuid' })
  customerId!: string;

  @Index()
  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  status!: KycStatus;

  @Column({ type: 'enum', enum: KycLevel, default: KycLevel.BASIC })
  requestedLevel!: KycLevel;

  @Column({ type: 'smallint', nullable: true })
  riskScore!: number | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ type: 'boolean', default: false })
  isPep!: boolean;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  reviewNotes!: string | null;

  @OneToMany(() => KycDocument, (d) => d.submission)
  documents!: KycDocument[];

  @OneToMany(() => AmlScreening, (s) => s.submission)
  screenings!: AmlScreening[];
}
