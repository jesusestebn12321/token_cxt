import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { buildSchemaOptions } from '../../../common/database/schema-options';

export enum ContractStandard {
  ERC20 = 'ERC20',
  ERC1400 = 'ERC1400', // security token
  ERC3643 = 'ERC3643', // T-REX, permissioned tokens
  ERC1155 = 'ERC1155',
}

@Schema(buildSchemaOptions('smart_contracts'))
export class SmartContract {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Token', required: true, index: true })
  tokenId!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  chainId!: number;

  /** Dirección EVM en formato checksum (EIP-55) */
  @Prop({ type: String, required: true })
  address!: string;

  @Prop({ type: String, enum: Object.values(ContractStandard), default: ContractStandard.ERC3643 })
  standard!: ContractStandard;

  @Prop({ type: String, default: null })
  deployTxHash!: string | null;

  @Prop({ type: String, default: null })
  deployedAtBlock!: string | null;

  @Prop({ type: Boolean, default: false })
  isPaused!: boolean;

  @Prop({ type: Date, default: null })
  lastSyncedAt!: Date | null;
}

export type SmartContractDocument = HydratedDocument<SmartContract>;
export const SmartContractSchema = SchemaFactory.createForClass(SmartContract);
// Un contrato es único por red + dirección
SmartContractSchema.index({ chainId: 1, address: 1 }, { unique: true });
