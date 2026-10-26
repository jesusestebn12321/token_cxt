import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { buildSchemaOptions } from '../../../common/database/schema-options';
import { makeImmutable } from '../../../common/database/immutable';

/**
 * Registro append-only con hash encadenado (cada fila incluye el hash de la anterior).
 * `seq` es único: si dos procesos intentan escribir el mismo eslabón, uno falla con
 * E11000 y AuditService reintenta (concurrencia optimista, sin locks).
 */
@Schema(
  buildSchemaOptions('audit_logs', {
    // createdAt se fija a mano porque forma parte del hash
    overrides: { timestamps: false, minimize: false },
  }),
)
export class AuditLog {
  @Prop({ type: Number, required: true, unique: true })
  seq!: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null, index: true })
  actorId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  actorEmail!: string | null;

  @Prop({ type: String, required: true, index: true })
  action!: string;

  @Prop({ type: String, required: true, index: true })
  resource!: string;

  @Prop({ type: String, default: null })
  resourceId!: string | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, required: true })
  prevHash!: string;

  @Prop({ type: String, required: true, unique: true })
  hash!: string;

  @Prop({ type: Date, required: true, index: true })
  createdAt!: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
makeImmutable(AuditLogSchema, 'AuditLog');
