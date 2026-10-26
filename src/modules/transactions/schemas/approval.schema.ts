import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { buildSchemaOptions } from '../../../common/database/schema-options';
import { ApprovalDecision } from '../enums/transaction-status.enum';

/** Subdocumento embebido en Transaction.approvals (un voto por aprobador). */
@Schema(
  buildSchemaOptions('transaction_approvals', {
    overrides: { collection: undefined, timestamps: { createdAt: true, updatedAt: false } },
  }),
)
export class Approval {
  /** Usuario del backoffice que decide */
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  approverId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ApprovalDecision), required: true })
  decision!: ApprovalDecision;

  @Prop({ type: String, default: null })
  comment!: string | null;
}

export const ApprovalSchema = SchemaFactory.createForClass(Approval);
