import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { buildSchemaOptions, DecimalProp } from '../../../common/database/schema-options';

export enum FundLockReason {
  COMPLIANCE_HOLD = 'COMPLIANCE_HOLD',
  LEGAL_ORDER = 'LEGAL_ORDER',
  FRAUD_INVESTIGATION = 'FRAUD_INVESTIGATION',
  PENDING_WITHDRAWAL = 'PENDING_WITHDRAWAL',
  OTHER = 'OTHER',
}

@Schema(buildSchemaOptions('fund_locks'))
export class FundLock {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Wallet', required: true, index: true })
  walletId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  tokenSymbol!: string;

  @DecimalProp({ required: true })
  amount!: string;

  @Prop({ type: String, enum: Object.values(FundLockReason), required: true })
  reason!: FundLockReason;

  @Prop({ type: String, default: null })
  notes!: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  lockedBy!: Types.ObjectId;

  @Prop({ type: Date, default: null, index: true })
  releasedAt!: Date | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  releasedBy!: Types.ObjectId | null;
}

export type FundLockDocument = HydratedDocument<FundLock>;
export const FundLockSchema = SchemaFactory.createForClass(FundLock);
