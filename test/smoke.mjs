// Smoke test temporal: levanta un MongoDB en memoria (replica set), siembra y ejercita la API real.
import { spawn, spawnSync } from 'node:child_process';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { authenticator } from 'otplib';

const PORT = 3055;
const BASE = `http://localhost:${PORT}/api/v1`;
const ADMIN = { email: 'admin@exchange.com', password: 'Sup3r-Secret-Pass!' };

let passed = 0;
let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ? ${name}`); }
  else { failed++; console.log(`  ? ${name} ${extra}`); }
};

let ipCounter = 0;
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.0.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`, // evita el throttle de login (5/min por IP)
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, data: json?.data };
};

const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
const uri = repl.getUri('rwa_test');
console.log('Mongo en memoria:', uri);

const env = {
  ...process.env,
  NODE_ENV: 'development', PORT: String(PORT), MONGODB_URI: uri, SWAGGER_ENABLED: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40),
  SEED_ADMIN_EMAIL: ADMIN.email, SEED_ADMIN_PASSWORD: ADMIN.password,
  THROTTLE_LIMIT: '1000',
};

let server;
try {
  console.log('\n[seed]');
  const seed = spawnSync('node', ['dist/database/seeds/run-seed.js'], { env, encoding: 'utf8' });
  console.log(seed.stdout + seed.stderr);
  check('seed exit 0', seed.status === 0);

  server = spawn('node', ['dist/main.js'], { env });
  let logs = '';
  server.stdout.on('data', (d) => (logs += d));
  server.stderr.on('data', (d) => (logs += d));

  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/api/docs-json`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
    if (i === 59) throw new Error('El servidor no arranc?:\n' + logs);
  }
  console.log('\n[arranque] servidor OK (DI resuelta, Swagger servido)');

  console.log('\n[auth]');
  let r = await call('POST', '/auth/login', { body: ADMIN });
  check('login sin 2FA devuelve tokens', r.status === 200 && r.data?.accessToken, JSON.stringify(r.json));
  let { accessToken, refreshToken } = r.data;

  r = await call('GET', '/auth/me', { token: accessToken });
  check('/auth/me con roles SUPER_ADMIN', r.data?.roles?.includes('SUPER_ADMIN') && r.data.permissions.length > 5, JSON.stringify(r.json));
  r = await call('GET', '/auth/me');
  check('sin token => 401', r.status === 401);
  r = await call('POST', '/auth/login', { body: { ...ADMIN, password: 'incorrecta-xx' } });
  check('password mala => 401', r.status === 401);

  r = await call('POST', '/users', { token: accessToken, body: { email: 'x@y.com', firstName: 'a', lastName: 'b', password: 'Abcdefgh1234!', roles: ['AUDITOR'] } });
  check('crear usuario sin 2FA verificado => 403 (TwoFactorGuard)', r.status === 403, JSON.stringify(r.json));

  r = await call('POST', '/auth/2fa/setup', { token: accessToken });
  const secret = r.data?.secret;
  check('2FA setup devuelve secret', !!secret, JSON.stringify(r.json));
  r = await call('POST', '/auth/2fa/enable', { token: accessToken, body: { code: authenticator.generate(secret) } });
  check('2FA enable', r.data?.enabled === true, JSON.stringify(r.json));

  r = await call('POST', '/auth/refresh', { body: { refreshToken } });
  check('refresh tras enable2FA revocado => 401', r.status === 401, JSON.stringify(r.json));

  r = await call('POST', '/auth/login', { body: ADMIN });
  check('login con 2FA => requiresTwoFactor', r.data?.requiresTwoFactor === true && r.data.twoFactorToken, JSON.stringify(r.json));
  const twoFactorToken = r.data.twoFactorToken;
  r = await call('POST', '/auth/2fa/verify', { body: { twoFactorToken, code: '000000' } });
  check('c?digo 2FA incorrecto => 401', r.status === 401);
  r = await call('POST', '/auth/2fa/verify', { body: { twoFactorToken, code: authenticator.generate(secret) } });
  check('2FA verify devuelve tokens', !!r.data?.accessToken, JSON.stringify(r.json));
  ({ accessToken, refreshToken } = r.data);

  r = await call('POST', '/auth/refresh', { body: { refreshToken } });
  check('refresh rota tokens', !!r.data?.refreshToken && r.data.refreshToken !== refreshToken, JSON.stringify(r.json));
  const rotated = r.data;
  r = await call('POST', '/auth/refresh', { body: { refreshToken } });
  check('reutilizar refresh viejo => 401 (y revoca familia)', r.status === 401);
  r = await call('POST', '/auth/refresh', { body: { refreshToken: rotated.refreshToken } });
  check('refresh nuevo tambi?n revocado tras reuso', r.status === 401);

  r = await call('POST', '/auth/login', { body: ADMIN });
  r = await call('POST', '/auth/2fa/verify', { body: { twoFactorToken: r.data.twoFactorToken, code: authenticator.generate(secret) } });
  accessToken = r.data.accessToken;

  console.log('\n[users / RBAC]');
  r = await call('POST', '/users', { token: accessToken, body: { email: 'aud@exchange.com', firstName: 'Ana', lastName: 'Auditora', password: 'Abcdefgh1234!', roles: ['AUDITOR'] } });
  check('crear usuario', r.status === 201 && r.data?.email === 'aud@exchange.com', JSON.stringify(r.json));
  check('respuesta NO expone passwordHash/secret', r.data && !('passwordHash' in r.data) && !('twoFactorSecret' in r.data) && r.data.id && !r.data._id);
  r = await call('POST', '/users', { token: accessToken, body: { email: 'aud@exchange.com', firstName: 'Ana', lastName: 'Auditora', password: 'Abcdefgh1234!', roles: ['AUDITOR'] } });
  check('email duplicado => 409', r.status === 409, JSON.stringify(r.json));
  r = await call('POST', '/users', { token: accessToken, body: { email: 'z@exchange.com', firstName: 'Z', lastName: 'Z', password: 'Abcdefgh1234!', roles: ['NOPE'] } });
  check('rol inv?lido => 400', r.status === 400, JSON.stringify(r.json));
  r = await call('GET', '/users/not-an-id', { token: accessToken });
  check('id inv?lido => 400', r.status === 400);
  r = await call('GET', '/users?limit=1', { token: accessToken });
  check('listado paginado', r.data?.items?.length === 1 && r.data.total === 2, JSON.stringify(r.json));

  // Auditor: login y comprobar permisos (sin 2FA)
  r = await call('POST', '/auth/login', { body: { email: 'aud@exchange.com', password: 'Abcdefgh1234!' } });
  const audToken = r.data?.accessToken;
  check('auditor puede loguear', !!audToken, JSON.stringify(r.json));
  r = await call('GET', '/audit/logs', { token: audToken });
  check('auditor lee audit logs', r.status === 200 && r.data.items.length > 0, JSON.stringify(r.json).slice(0, 200));
  r = await call('POST', '/tokens', { token: audToken, body: {} });
  check('auditor sin permiso tokens:write => 403', r.status === 403);

  console.log('\n[tokens]');
  r = await call('POST', '/tokens', { token: accessToken, body: { symbol: 'RWAHOUSE1', name: 'Casa 1', assetClass: 'REAL_ESTATE', maxSupply: '1000000' } });
  check('crear token', r.status === 201 && r.data?.symbol === 'RWAHOUSE1', JSON.stringify(r.json));
  const tokenId = r.data?.id;
  r = await call('POST', '/tokens', { token: accessToken, body: { symbol: 'RWAHOUSE1', name: 'Casa 1', assetClass: 'REAL_ESTATE', maxSupply: '1000000' } });
  check('s?mbolo duplicado => 409', r.status === 409);
  r = await call('POST', `/tokens/${tokenId}/contracts`, { token: accessToken, body: { chainId: 11155111, address: '0x52908400098527886E0F7030069857D2E4169EE7', standard: 'ERC3643' } });
  check('registrar contrato (checksum)', r.status === 201 && r.data?.address === '0x52908400098527886E0F7030069857D2E4169EE7', JSON.stringify(r.json));
  r = await call('POST', `/tokens/${tokenId}/contracts`, { token: accessToken, body: { chainId: 11155111, address: '0x52908400098527886e0f7030069857d2e4169ee7', standard: 'ERC3643' } });
  check('contrato duplicado (otra capitalizaci?n) => 409', r.status === 409, JSON.stringify(r.json));
  r = await call('GET', `/tokens/${tokenId}`, { token: accessToken });
  check('token incluye contratos', r.data?.contracts?.length === 1 && r.data.id === tokenId, JSON.stringify(r.json).slice(0, 200));

  console.log('\n[wallets / ledger / transacciones Mongo]');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const walletId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const now = new Date();
  await db.collection('wallets').insertOne({ _id: walletId, customerId, label: 'w', address: null, chainId: null, isFrozen: false, frozenReason: null, createdAt: now, updatedAt: now });
  await db.collection('balances').insertOne({ walletId, tokenSymbol: 'RWAHOUSE1', available: mongoose.Types.Decimal128.fromString('150.5'), locked: mongoose.Types.Decimal128.fromString('0'), createdAt: now, updatedAt: now });

  r = await call('POST', `/wallets/${walletId}/locks`, { token: accessToken, body: { tokenSymbol: 'RWAHOUSE1', amount: '1000', reason: 'COMPLIANCE_HOLD' } });
  check('bloqueo > saldo => 409', r.status === 409, JSON.stringify(r.json));
  r = await call('POST', `/wallets/${walletId}/locks`, { token: accessToken, body: { tokenSymbol: 'RWAHOUSE1', amount: '50.25', reason: 'COMPLIANCE_HOLD', notes: 'x' } });
  check('bloqueo OK (transacci?n Mongo)', r.status === 201 && r.data?.amount === '50.25' && r.data.releasedAt === null, JSON.stringify(r.json));
  const lockId = r.data?.id;
  r = await call('GET', `/wallets/${walletId}/balances`, { token: accessToken });
  check('saldo: available 100.25 / locked 50.25 (strings exactos)', r.data?.[0]?.available === '100.25' && r.data[0].locked === '50.25', JSON.stringify(r.json));
  r = await call('POST', `/wallets/locks/${lockId}/release`, { token: accessToken });
  check('liberar bloqueo', r.status === 201 && !!r.data?.releasedAt, JSON.stringify(r.json));
  r = await call('POST', `/wallets/locks/${lockId}/release`, { token: accessToken });
  check('liberar dos veces => 409', r.status === 409, JSON.stringify(r.json));
  r = await call('GET', `/wallets/${walletId}/balances`, { token: accessToken });
  check('saldo restaurado 150.5 / 0', r.data?.[0]?.available === '150.5' && r.data[0].locked === '0', JSON.stringify(r.json));
  r = await call('GET', `/wallets/${walletId}/ledger`, { token: accessToken });
  check('ledger con 2 asientos (DEBIT lock, CREDIT release)', r.data?.total === 2 && r.data.items[0].direction === 'CREDIT' && r.data.items[1].direction === 'DEBIT' && r.data.items[1].balanceAfter === '100.25', JSON.stringify(r.json).slice(0, 300));
  r = await call('PATCH', `/wallets/${walletId}/freeze`, { token: accessToken, body: { frozen: true, reason: 'investigaci?n' } });
  check('congelar wallet', r.data?.isFrozen === true, JSON.stringify(r.json));

  console.log('\n[transactions: maker-checker]');
  const txId = new mongoose.Types.ObjectId();
  await db.collection('transactions').insertOne({ _id: txId, customerId, walletId, type: 'WITHDRAWAL', status: 'PENDING_APPROVAL', tokenSymbol: 'RWAHOUSE1', amount: mongoose.Types.Decimal128.fromString('10'), fee: mongoose.Types.Decimal128.fromString('0'), counterpartyAddress: null, txHash: null, chainId: null, requiredApprovals: 2, riskScore: 0, failureReason: null, approvals: [], createdAt: now, updatedAt: now });
  r = await call('POST', `/transactions/${txId}/decision`, { token: accessToken, body: { decision: 'REJECTED' } });
  check('rechazo sin comentario => 400', r.status === 400);
  r = await call('POST', `/transactions/${txId}/decision`, { token: accessToken, body: { decision: 'APPROVED' } });
  check('1? aprobaci?n (de 2) => sigue pendiente', r.data?.status === 'PENDING_APPROVAL' && r.data.approvals.length === 1, JSON.stringify(r.json));
  r = await call('POST', `/transactions/${txId}/decision`, { token: accessToken, body: { decision: 'APPROVED' } });
  check('mismo aprobador no vota 2 veces => 409', r.status === 409, JSON.stringify(r.json));

  // Segundo aprobador: otro super admin creado v?a API + 2FA
  r = await call('POST', '/users', { token: accessToken, body: { email: 'ops@exchange.com', firstName: 'O', lastName: 'P', password: 'Abcdefgh1234!', roles: ['TREASURY'] } });
  const opsLogin = await call('POST', '/auth/login', { body: { email: 'ops@exchange.com', password: 'Abcdefgh1234!' } });
  const opsToken = opsLogin.data?.accessToken;
  const opsSetup = await call('POST', '/auth/2fa/setup', { token: opsToken });
  await call('POST', '/auth/2fa/enable', { token: opsToken, body: { code: authenticator.generate(opsSetup.data.secret) } });
  const opsLogin2 = await call('POST', '/auth/login', { body: { email: 'ops@exchange.com', password: 'Abcdefgh1234!' } });
  const opsVerified = await call('POST', '/auth/2fa/verify', { body: { twoFactorToken: opsLogin2.data.twoFactorToken, code: authenticator.generate(opsSetup.data.secret) } });
  r = await call('POST', `/transactions/${txId}/decision`, { token: opsVerified.data.accessToken, body: { decision: 'APPROVED' } });
  check('2? aprobaci?n (otro usuario) => APPROVED', r.data?.status === 'APPROVED' && r.data.approvals.length === 2, JSON.stringify(r.json));
  r = await call('POST', `/transactions/${txId}/decision`, { token: opsVerified.data.accessToken, body: { decision: 'APPROVED' } });
  check('decidir una ya APPROVED => 409', r.status === 409);
  r = await call('GET', `/transactions?status=APPROVED&type=WITHDRAWAL`, { token: accessToken });
  check('listado filtrado', r.data?.total === 1, JSON.stringify(r.json).slice(0, 200));

  console.log('\n[kyc]');
  const kycId = new mongoose.Types.ObjectId();
  await db.collection('kyc_submissions').insertOne({ _id: kycId, customerId, status: 'PENDING', requestedLevel: 'BASIC', riskScore: null, countryCode: 'CL', isPep: false, reviewedBy: null, reviewedAt: null, reviewNotes: null, documents: [{ _id: new mongoose.Types.ObjectId(), type: 'ID_FRONT', storageKey: 'k', mimeType: 'image/png', verified: false }], screenings: [{ _id: new mongoose.Types.ObjectId(), provider: 'x', result: 'CLEAR', matches: [] }], createdAt: now, updatedAt: now });
  r = await call('POST', `/kyc/submissions/${kycId}/review`, { token: accessToken, body: { decision: 'REJECT' } });
  check('rechazar KYC sin notas => 400', r.status === 400);
  r = await call('POST', `/kyc/submissions/${kycId}/claim`, { token: accessToken });
  check('claim KYC', r.data?.status === 'IN_REVIEW', JSON.stringify(r.json));
  r = await call('POST', `/kyc/submissions/${kycId}/claim`, { token: accessToken });
  check('claim doble => 409', r.status === 409);
  r = await call('POST', `/kyc/submissions/${kycId}/review`, { token: accessToken, body: { decision: 'APPROVE', grantedLevel: 'ADVANCED', riskScore: 12 } });
  check('aprobar KYC', r.data?.status === 'APPROVED' && r.data.requestedLevel === 'ADVANCED' && r.data.riskScore === 12 && r.data.documents.length === 1, JSON.stringify(r.json));
  r = await call('POST', `/kyc/submissions/${kycId}/review`, { token: accessToken, body: { decision: 'REJECT', notes: 'x' } });
  check('revisar ya resuelta => 409', r.status === 409);

  console.log('\n[audit: cadena + inmutabilidad]');
  r = await call('GET', '/audit/verify', { token: accessToken });
  check(`cadena de hashes v?lida (${r.data?.checked} eslabones)`, r.data?.valid === true && r.data.checked > 15, JSON.stringify(r.json));
  r = await call('GET', '/audit/logs?action=KYC_REVIEWED', { token: accessToken });
  check('filtrar auditor?a por acci?n', r.data?.total === 1 && r.data.items[0].actorEmail === ADMIN.email, JSON.stringify(r.json).slice(0, 200));
  check('auditor?a redacta secretos del body', JSON.stringify((await call('GET', '/audit/logs?action=USER_CREATED', { token: accessToken })).json).includes('[REDACTED]'));

  // Intentar manipular el log v?a Mongoose (capa de aplicaci?n)
  const AuditModel = mongoose.model('AuditProbe', new mongoose.Schema({}, { strict: false }), 'audit_logs');
  await db.collection('audit_logs').updateOne({ seq: 3 }, { $set: { action: 'HACKED' } }); // bypass app (acceso directo a BD)
  r = await call('GET', '/audit/verify', { token: accessToken });
  check('manipulaci?n directa en BD detectada por verify', r.data?.valid === false && r.data.brokenAtSeq === 3, JSON.stringify(r.json));
  void AuditModel;

  console.log('\n[concurrencia audit]');
  await db.collection('audit_logs').updateOne({ seq: 3 }, { $set: { action: 'x' } }); // no se restaura el hash original; solo comprobamos append concurrente
  const before = await db.collection('audit_logs').countDocuments();
  await Promise.all(Array.from({ length: 40 }, () => call('POST', '/auth/login', { body: { ...ADMIN, password: 'mala-mala-mala' } })));
  const after = await db.collection('audit_logs').countDocuments();
  const seqs = (await db.collection('audit_logs').find({}, { projection: { seq: 1 } }).sort({ seq: 1 }).toArray()).map((d) => d.seq);
  check('40 appends concurrentes => 40 eslabones sin huecos ni duplicados', after - before === 40 && seqs.every((s, i) => s === i + 1), `delta=${after - before}`);

  console.log(`\nRESULTADO: ${passed} OK, ${failed} fallos`);
  if (failed) console.log('\n--- logs servidor (?ltimas l?neas) ---\n' + logs.split('\n').slice(-30).join('\n'));
} catch (e) {
  failed++;
  console.error('ERROR:', e);
} finally {
  await mongoose.disconnect().catch(() => {});
  server?.kill();
  await repl.stop();
  process.exit(failed ? 1 : 0);
}
