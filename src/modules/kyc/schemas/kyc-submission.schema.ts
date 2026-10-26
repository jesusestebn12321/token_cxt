import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { buildSchemaOptions } from '../../../common/database/schema-options';
import { KycLevel, KycStatus } from '../enums/kyc-status.enum';
import { AmlScreening, AmlScreeningSchema } from './aml-screening.schema';
import { KycDocument, KycDocumentSchema } from './kyc-document.schema';

@Schema(buildSchemaOptions('kyc_submissions'))
export class KycSubmission {
  /** Usuario final del exchange (no es un usuario de backoffice) */
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(KycStatus), default: KycStatus.PENDING, index: true })
  status!: KycStatus;

  @Prop({ type: String, enum: Object.values(KycLevel), default: KycLevel.BASIC })
  requestedLevel!: KycLevel;

  @Prop({ type: Number, min: 0, max: 100, default: null })
  riskScore!: number | null;

  @Prop({ type: String, default: null, minlength: 2, maxlength: 2 })
  countryCode!: string | null;

  @Prop({ type: Boolean, default: false })
  isPep!: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  reviewedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reviewedAt!: Date | null;

  @Prop({ type: String, default: null })
  reviewNotes!: string | null;

  @Prop({ type: [KycDocumentSchema], default: [] })
  documents!: KycDocument[];

  @Prop({ type: [AmlScreeningSchema], default: [] })
  screenings!: AmlScreening[];
}

export type KycSubmissionDocument = HydratedDocument<KycSubmission>;
export const KycSubmissionSchema = SchemaFactory.createForClass(KycSubmission);
// Cola de revisión: filtra por estado y ordena por antigüedad
KycSubmissionSchema.index({ status: 1, createdAt: 1 });
