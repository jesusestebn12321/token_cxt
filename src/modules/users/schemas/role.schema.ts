import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { buildSchemaOptions } from '../../../common/database/schema-options';

/**
 * Definición de rol RBAC. Se llama AccessRole para no chocar con el enum `Role`.
 * Los permisos se guardan embebidos como códigos del enum `Permission` (p. ej. 'users:read').
 */
@Schema(buildSchemaOptions('roles'))
export class AccessRole {
  /** Valor del enum Role, p. ej. 'COMPLIANCE_OFFICER' */
  @Prop({ type: String, required: true, unique: true, trim: true })
  name!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ type: [String], default: [] })
  permissions!: string[];
}

export type AccessRoleDocument = HydratedDocument<AccessRole>;
export const AccessRoleSchema = SchemaFactory.createForClass(AccessRole);
