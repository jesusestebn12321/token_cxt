import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { buildSchemaOptions } from '../../../common/database/schema-options';

@Schema(buildSchemaOptions('wallets'))
export class Wallet {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: String, default: null, maxlength: 100 })
  label!: string | null;

  /** Dirección EVM de depósito asociada (opcional en wallets puramente internas) */
  @Prop({ type: String, default: null, index: true })
  address!: string | null;

  @Prop({ type: Number, default: null })
  chainId!: number | null;

  /** Wallet congelada: sin movimientos ni retiros */
  @Prop({ type: Boolean, default: false })
  isFrozen!: boolean;

  @Prop({ type: String, default: null })
  frozenReason!: string | null;
}

export type WalletDocument = HydratedDocument<Wallet>;
export const WalletSchema = SchemaFactory.createForClass(Wallet);
