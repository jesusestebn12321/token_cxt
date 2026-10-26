import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { buildSchemaOptions } from '../../../common/database/schema-options';
import { KycDocumentType } from '../enums/kyc-status.enum';

/** Subdocumento embebido en KycSubmission.documents */
@Schema(buildSchemaOptions('kyc_documents', { overrides: { collection: undefined } }))
export class KycDocument {
  @Prop({ type: String, enum: Object.values(KycDocumentType), required: true })
  type!: KycDocumentType;

  /** Clave en el almacenamiento cifrado (S3/GCS). Nunca guardar el archivo en BD. */
  @Prop({ type: String, required: true, maxlength: 512 })
  storageKey!: string;

  @Prop({ type: String, required: true, maxlength: 100 })
  mimeType!: string;

  @Prop({ type: Boolean, default: false })
  verified!: boolean;
}

export const KycDocumentSchema = SchemaFactory.createForClass(KycDocument);
