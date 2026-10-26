import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { buildSchemaOptions } from '../../../common/database/schema-options';

@Schema(buildSchemaOptions('refresh_tokens', { hidden: ['tokenHash'] }))
export class RefreshToken {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  /** SHA-256 del refresh token (nunca se guarda el token en claro) */
  @Prop({ type: String, required: true, unique: true })
  tokenHash!: string;

  @Prop({ type: Boolean, default: false })
  twoFactorVerified!: boolean;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
// TTL: MongoDB elimina el documento al llegar a expiresAt
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
