import { Prop, SchemaOptions } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

interface BuildOptions {
  /** Campos que NUNCA deben salir en JSON (hashes, secretos). */
  hidden?: string[];
  overrides?: SchemaOptions;
}

/**
 * Opciones base de schema:
 *  - timestamps (createdAt / updatedAt), sin __v
 *  - toJSON: expone `id` en vez de `_id`, aplica getters (Decimal128 → string)
 *    y oculta los campos sensibles.
 */
export function buildSchemaOptions(
  collection: string,
  { hidden = [], overrides = {} }: BuildOptions = {},
): SchemaOptions {
  return {
    collection,
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      getters: true,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        delete ret._id;
        for (const key of hidden) delete ret[key];
        return ret;
      },
    },
    ...overrides,
  };
}

/**
 * Decimal128 conserva la escala tras las operaciones ($inc de 50.25 sobre 100 → "150.50")
 * y puede usar notación exponencial. Se normaliza a decimal plano sin ceros finales.
 */
export function normalizeDecimal(raw: string): string {
  let text = raw;
  const exp = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
  if (exp) {
    const [, sign, int, frac = '', e] = exp;
    const digits = int + frac;
    const point = int.length + Number(e);
    text =
      point <= 0
        ? `${sign}0.${'0'.repeat(-point)}${digits}`
        : point >= digits.length
          ? `${sign}${digits}${'0'.repeat(point - digits.length)}`
          : `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
  }
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

interface DecimalOptions {
  required?: boolean;
  default?: string | null;
}

/**
 * Importes monetarios/cantidades: Decimal128 (34 dígitos significativos, p. ej.
 * 16 enteros + 18 decimales). Se expone como string para no perder precisión.
 * Soporta $inc y comparaciones atómicas ($gte) en MongoDB.
 */
export const DecimalProp = (options: DecimalOptions = {}) =>
  Prop({
    type: MongooseSchema.Types.Decimal128,
    get: (value?: Types.Decimal128 | null) =>
      value == null ? value : normalizeDecimal(value.toString()),
    ...options,
  });
