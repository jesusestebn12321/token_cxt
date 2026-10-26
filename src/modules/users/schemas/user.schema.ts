import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { buildSchemaOptions } from '../../../common/database/schema-options';

@Schema(buildSchemaOptions('users', { hidden: ['passwordHash', 'twoFactorSecret'] }))
export class User {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  firstName!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  lastName!: string;

  @Prop({ type: String, required: true, select: false })
  passwordHash!: string;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: Boolean, default: false })
  twoFactorEnabled!: boolean;

  /** Secreto TOTP. Recomendado: cifrar en reposo (AES-GCM / KMS) antes de producción. */
  @Prop({ type: String, default: null, select: false })
  twoFactorSecret!: string | null;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  @Prop({ type: Number, default: 0 })
  failedLoginAttempts!: number;

  @Prop({ type: Date, default: null })
  lockedUntil!: Date | null;

  /** Nombres de rol (enum Role). Los permisos se resuelven desde la colección `roles`. */
  @Prop({ type: [String], default: [] })
  roles!: string[];
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
