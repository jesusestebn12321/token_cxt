import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { buildSchemaOptions, DecimalProp } from '../../../common/database/schema-options';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import { Approval, ApprovalSchema } from './approval.schema';

@Schema(buildSchemaOptions('transactions'))
export class Transaction {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Wallet', required: true, index: true })
  walletId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(TransactionType), required: true })
  type!: TransactionType;

  @Prop({
    type: String,
    enum: Object.values(TransactionStatus),
    default: TransactionStatus.PENDING_APPROVAL,
  })
  status!: TransactionStatus;

  @Prop({ type: String, required: true })
  tokenSymbol!: string;

  @DecimalProp({ required: true })
  amount!: string;

  @DecimalProp({ required: true, default: '0' })
  fee!: string;

  /** Dirección EVM destino (retiros) u origen (depósitos) */
  @Prop({ type: String, default: null })
  counterpartyAddress!: string | null;

  @Prop({ type: String, default: null, index: true })
  txHash!: string | null;

  @Prop({ type: Number, default: null })
  chainId!: number | null;

  @Prop({ type: Number, min: 1, default: 1 })
  requiredApprovals!: number;

  @Prop({ type: Number, default: 0 })
  riskScore!: number;

  @Prop({ type: String, default: null })
  failureReason!: string | null;

  @Prop({ type: [ApprovalSchema], default: [] })
  approvals!: Approval[];
}

export type TransactionDocument = HydratedDocument<Transaction>;
export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ status: 1, createdAt: -1 });
TransactionSchema.index({ type: 1, status: 1, createdAt: -1 });
