// Smoke test contra el stack de Docker ya levantado (docker compose up -d && seed).
//   API_URL=http://localhost:3000 node test/docker-smoke.mjs
import { execFileSync } from 'node:child_process';
import { authenticator } from 'otplib';

const BASE = `${process.env.API_URL ?? 'http://localhost:3000'}/api/v1`;
const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@exchange.com',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'Sup3r-Secret-Pass!',
};
let failed = 0;
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log(`${ok ? '  OK ' : '  FAIL'} ${name} ${ok ? '' : extra}`); };
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data, json };
};
const mongosh = (js) =>
  execFileSync('docker', ['compose', 'exec', '-T', 'mongo', 'sh', '-c',
    `mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_DB" --eval '${js}'`],
    { encoding: 'utf8' }).trim();

let r = await call('GET', '/health');
check('health (API + Mongo)', r.data?.database === 'up', JSON.stringify(r.json));

r = await call('POST', '/auth/login', { body: ADMIN });
let token = r.data?.accessToken;
check('login', !!token, JSON.stringify(r.json));

r = await call('POST', '/auth/2fa/setup', { token });
const secret = r.data?.secret;
r = await call('POST', '/auth/2fa/enable', { token, body: { code: authenticator.generate(secret) } });
check('2FA activado', r.data?.enabled === true, JSON.stringify(r.json));
r = await call('POST', '/auth/login', { body: ADMIN });
r = await call('POST', '/auth/2fa/verify', { body: { twoFactorToken: r.data.twoFactorToken, code: authenticator.generate(secret) } });
token = r.data?.accessToken;
check('login con 2FA', !!token, JSON.stringify(r.json));

const walletId = mongosh(`const id=new ObjectId(); db.wallets.insertOne({_id:id,customerId:new ObjectId(),isFrozen:false,createdAt:new Date(),updatedAt:new Date()}); db.balances.insertOne({walletId:id,tokenSymbol:"RWA1",available:Decimal128.fromString("100"),locked:Decimal128.fromString("0"),createdAt:new Date(),updatedAt:new Date()}); print(id.toString())`).split('\n').pop();
r = await call('POST', `/wallets/${walletId}/locks`, { token, body: { tokenSymbol: 'RWA1', amount: '40.5', reason: 'COMPLIANCE_HOLD' } });
check('bloqueo de fondos (transacción multi-documento)', r.status === 201, JSON.stringify(r.json));
r = await call('GET', `/wallets/${walletId}/balances`, { token });
check('saldos 59.5 / 40.5', r.data?.[0]?.available === '59.5' && r.data[0].locked === '40.5', JSON.stringify(r.json));
r = await call('GET', '/audit/verify', { token });
check('cadena de auditoría íntegra', r.data?.valid === true && r.data.checked > 0, JSON.stringify(r.json));

console.log(failed ? `\n${failed} FALLOS` : '\nDocker smoke OK');
process.exit(failed ? 1 : 0);
