import { Schema } from 'mongoose';

const BLOCKED_OPERATIONS = [
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'deleteOne',
  'deleteMany',
] as const;

/**
 * Convierte la colección en append-only a nivel de aplicación (solo insert).
 * Refuerzo recomendado a nivel de BD: usuario Mongo con rol que solo permita
 * `insert` y `find` sobre estas colecciones.
 */
export function makeImmutable(schema: Schema, name: string): void {
  const fail = (op: string): never => {
    throw new Error(`${name} es inmutable: ${op} no permitido`);
  };

  schema.pre('save', function () {
    if (!this.isNew) fail('UPDATE');
  });

  schema.pre([...BLOCKED_OPERATIONS], function () {
    fail('UPDATE/DELETE');
  });

  schema.pre(['updateOne', 'deleteOne'], { document: true, query: false }, function () {
    fail('UPDATE/DELETE');
  });
}
