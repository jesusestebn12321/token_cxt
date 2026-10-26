import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { buildSchemaOptions, DecimalProp } from '../../../common/database/schema-options';

/**
 * Saldo por (wallet, token). Los importes son Decimal128 y se modifican SIEMPRE con
 * operaciones atómicas condicionales ($inc + filtro $gte), nunca leyendo y guardando.
 * Esto sustituye a los CHECK (>= 0) de SQL: el filtro garantiza que no haya negativos.
 */
@Schema(buildSchemaOptions('balances'))
export class Balance {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Wallet', required: true })
  walletId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  tokenSymbol!: string;

  @DecimalProp({ required: true, default: '0' })
  available!: string;

  /** Saldo bloqueado por FundLocks activos */
  @DecimalProp({ required: true, default: '0' })
  locked!: string;
}

export type BalanceDocument = HydratedDocument<Balance>;
export const BalanceSchema = SchemaFactory.createForClass(Balance);
BalanceSchema.index({ walletId: 1, tokenSymbol: 1 }, { unique: true });
