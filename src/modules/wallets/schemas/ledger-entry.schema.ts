import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { makeImmutable } from '../../../common/database/immutable';
import { buildSchemaOptions, DecimalProp } from '../../../common/database/schema-options';

export enum LedgerDirection {
  DEBIT = 'DEBIT', // disminuye el saldo disponible
  CREDIT = 'CREDIT', // aumenta el saldo disponible
}

/** Libro mayor append-only: las correcciones se hacen con asientos de reverso. */
@Schema(buildSchemaOptions('ledger_entries', { overrides: { timestamps: { createdAt: true, updatedAt: false } } }))
export class LedgerEntry {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Wallet', required: true })
  walletId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  tokenSymbol!: string;

  @Prop({ type: String, enum: Object.values(LedgerDirection), required: true })
  direction!: LedgerDirection;

  @DecimalProp({ required: true })
  amount!: string;

  /** Saldo disponible resultante tras aplicar el asiento */
  @DecimalProp({ required: true })
  balanceAfter!: string;

  /** Ej: 'DEPOSIT', 'WITHDRAWAL', 'FUND_LOCK', 'FUND_RELEASE', 'TRADE' */
  @Prop({ type: String, required: true, index: true })
  referenceType!: string;

  @Prop({ type: String, default: null, index: true })
  referenceId!: string | null;

  createdAt!: Date;
}

export type LedgerEntryDocument = HydratedDocument<LedgerEntry>;
export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);
LedgerEntrySchema.index({ walletId: 1, tokenSymbol: 1, _id: -1 });
makeImmutable(LedgerEntrySchema, 'LedgerEntry');
