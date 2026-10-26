import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { buildSchemaOptions, DecimalProp } from '../../../common/database/schema-options';

export enum TokenStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  RETIRED = 'RETIRED',
}

export enum AssetClass {
  REAL_ESTATE = 'REAL_ESTATE',
  PRIVATE_EQUITY = 'PRIVATE_EQUITY',
  FIXED_INCOME = 'FIXED_INCOME',
  COMMODITY = 'COMMODITY',
  ART = 'ART',
  OTHER = 'OTHER',
}

@Schema(buildSchemaOptions('tokens'))
export class Token {
  @Prop({ type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 })
  symbol!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 150 })
  name!: string;

  @Prop({ type: String, enum: Object.values(AssetClass), required: true })
  assetClass!: AssetClass;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ type: Number, min: 0, max: 18, default: 18 })
  decimals!: number;

  /** Suministro máximo autorizado, entero como string (puede superar los 34 dígitos de Decimal128) */
  @Prop({ type: String, required: true })
  maxSupply!: string;

  /** Valoración del activo subyacente en USD (informativa) */
  @DecimalProp({ default: null })
  underlyingValueUsd!: string | null;

  @Prop({ type: String, enum: Object.values(TokenStatus), default: TokenStatus.DRAFT, index: true })
  status!: TokenStatus;

  /** Nivel KYC mínimo para poseer/operar el token */
  @Prop({ type: String, default: 'INTERMEDIATE' })
  requiredKycLevel!: string;
}

export type TokenDocument = HydratedDocument<Token>;
export const TokenSchema = SchemaFactory.createForClass(Token);
