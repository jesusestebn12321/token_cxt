import { readFileSync } from 'node:fs';

const appModule = readFileSync(new URL('../src/app.module.ts', import.meta.url), 'utf8');
const wired = ['WalletsModule', 'KycModule', 'TransactionsModule', 'AuditModule', 'MongooseModule']
  .filter((name) => appModule.includes(name));

if (wired.length) {
  console.log('app.module importa módulos que esta API no expone:\n' + wired.join('\n'));
  process.exit(1);
}

console.log('app.module: solo health, auth, usuarios y roles');
