import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { buildSchemaOptions } from '../../../common/database/schema-options';
import { AmlResult } from '../enums/kyc-status.enum';

/** Subdocumento embebido en KycSubmission.screenings */
@Schema(buildSchemaOptions('aml_screenings', { overrides: { collection: undefined } }))
export class AmlScreening {
  /** Proveedor externo (Chainalysis, Sumsub, ComplyAdvantage...) */
  @Prop({ type: String, required: true })
  provider!: string;

  @Prop({ type: String, enum: Object.values(AmlResult), required: true })
  result!: AmlResult;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  matches!: Record<string, unknown>[];
}

export const AmlScreeningSchema = SchemaFactory.createForClass(AmlScreening);
