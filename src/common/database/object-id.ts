import { Types } from 'mongoose';

export const oid = (id: string): Types.ObjectId => new Types.ObjectId(id);

export const oidOrNull = (id: string | null | undefined): Types.ObjectId | null =>
  id ? new Types.ObjectId(id) : null;

export const dec = (value: string): Types.Decimal128 => Types.Decimal128.fromString(value);
