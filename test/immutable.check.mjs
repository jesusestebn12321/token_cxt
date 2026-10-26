import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { AuditLogSchema } from '../dist/modules/audit/schemas/audit-log.schema.js';
import { LedgerEntrySchema } from '../dist/modules/wallets/schemas/ledger-entry.schema.js';

const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(repl.getUri('imm'));
let bad = 0;
const expectThrow = async (name, fn) => {
  try { await fn(); bad++; console.log(`✘ ${name}: NO lanzó error`); }
  catch (e) { console.log(`✔ ${name}: ${e.message}`); }
};

for (const [label, schema, doc] of [
  ['AuditLog', AuditLogSchema, { seq: 1, action: 'A', resource: 'r', prevHash: '0', hash: 'h', createdAt: new Date() }],
  ['LedgerEntry', LedgerEntrySchema, { walletId: new mongoose.Types.ObjectId(), tokenSymbol: 'X', direction: 'DEBIT', amount: '1', balanceAfter: '1', referenceType: 'T' }],
]) {
  const M = mongoose.model(label, schema);
  const created = await M.create(doc);
  console.log(`\n${label}: insert OK`);
  await expectThrow(`${label} updateOne`, () => M.updateOne({ _id: created._id }, { $set: { action: 'x' } }));
  await expectThrow(`${label} updateMany`, () => M.updateMany({}, { $set: { action: 'x' } }));
  await expectThrow(`${label} findOneAndUpdate`, () => M.findOneAndUpdate({ _id: created._id }, { $set: { action: 'x' } }));
  await expectThrow(`${label} deleteOne`, () => M.deleteOne({ _id: created._id }));
  await expectThrow(`${label} deleteMany`, () => M.deleteMany({}));
  await expectThrow(`${label} findOneAndDelete`, () => M.findOneAndDelete({ _id: created._id }));
  await expectThrow(`${label} doc.save() tras modificar`, async () => { const d = await M.findById(created._id); d.set(label === 'AuditLog' ? 'action' : 'tokenSymbol', 'Z'); await d.save(); });
  await expectThrow(`${label} doc.deleteOne()`, async () => { const d = await M.findById(created._id); await d.deleteOne(); });
  console.log(`${label}: sigue existiendo =`, !!(await M.findById(created._id)));
}
await mongoose.disconnect();
await repl.stop();
console.log(bad ? `\n${bad} FALLOS` : '\nInmutabilidad OK');
process.exit(bad ? 1 : 0);
