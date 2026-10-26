import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { KycDocumentType } from '../enums/kyc-status.enum';
import { KycSubmission } from './kyc-submission.entity';

@Entity('kyc_documents')
export class KycDocument extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  submissionId!: string;

  @ManyToOne(() => KycSubmission, (s) => s.documents, { onDelete: 'CASCADE' })
  submission!: KycSubmission;

  @Column({ type: 'enum', enum: KycDocumentType })
  type!: KycDocumentType;

  /** Clave en el almacenamiento cifrado (S3/GCS). Nunca guardar el archivo en BD. */
  @Column({ type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ type: 'boolean', default: false })
  verified!: boolean;
}
