// Frontera de seguridad: el cliente que compra/vende no es un usuario del backoffice.
// Levanta Mongo en memoria, siembra y comprueba que no hay sesión de cliente
// capaz de leer datos ajenos, forjar un rol o entrar al panel interno.
import { createHmac } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { authenticator } from 'otplib';

const PORT = 3057;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
const ADMIN = { email: 'admin@exchange.com', password: 'Sup3r-Secret-Pass!' };
const STAFF_PASSWORD = 'Abcdefgh1234!';

let passed = 0;
let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) {
    passed++;
    console.log(`  OK  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name} ${extra}`);
  }
};

let ipCounter = 0;
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.8.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, data: json?.data };
};

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const signHs256 = (payload, secret) => {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
};

const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
const uri = repl.getUri('rwa_customer_boundary');
const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: String(PORT),
  MONGODB_URI: uri,
  SWAGGER_ENABLED: 'false',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  SEED_ADMIN_EMAIL: ADMIN.email,
  SEED_ADMIN_PASSWORD: ADMIN.password,
  THROTTLE_LIMIT: '1000',
};
delete env.NODE_OPTIONS;

let server;
let logs = '';
try {
  const seed = spawnSync(process.execPath, ['dist/apps/api-gateway/database/seeds/run-seed.js'], { env, encoding: 'utf8' });
  check('seed del personal', seed.status === 0, seed.stderr);

  server = spawn(process.execPath, ['dist/apps/api-gateway/main.js'], { env });
  server.stdout.on('data', (d) => (logs += d));
  server.stderr.on('data', (d) => (logs += d));
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    try {
      ready = (await fetch(`http://127.0.0.1:${PORT}/api/v1/health/live`)).ok;
    } catch {
      ready = false;
    }
    if (!ready) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!ready) throw new Error('El servidor no arrancó:\n' + logs.slice(-2000));

  const customerId = '671eaa001122334455667788';

  console.log('\n[cliente sin cuenta de backoffice]');
  let r = await call('POST', '/auth/register', {
    body: { email: 'cliente@exchange.com', password: STAFF_PASSWORD },
  });
  check('no existe register público', r.status === 404, String(r.status));

  for (const path of ['/customers', '/customers/register', '/orders', '/trades']) {
    r = await call('POST', path, { body: { customerId, email: 'cliente@exchange.com' } });
    check(`POST ${path} no abre sesión de cliente`, r.status === 404, String(r.status));
  }

  r = await call('POST', '/auth/login', {
    body: { email: 'cliente@exchange.com', password: STAFF_PASSWORD, customerId, roles: ['SUPER_ADMIN'] },
  });
  check('login rechaza customerId y roles inyectados', r.status === 400, JSON.stringify(r.json));

  r = await call('POST', '/auth/login', {
    body: { email: 'cliente@exchange.com', password: STAFF_PASSWORD },
  });
  const unknownLogin = r;
  check('email de cliente desconocido => 401', r.status === 401, JSON.stringify(r.json));

  r = await call('POST', '/auth/login', { body: { ...ADMIN, password: 'clave-incorrecta-1' } });
  check(
    'mensaje igual para cliente inexistente y contraseña mala',
    unknownLogin.status === 401 && r.status === 401 && unknownLogin.json?.message === r.json?.message,
    JSON.stringify({ unknown: unknownLogin.json?.message, bad: r.json?.message }),
  );

  console.log('\n[datos del cliente sin sesión]');
  for (const path of [
    `/transactions?customerId=${customerId}`,
    '/wallets',
    '/kyc/submissions',
    `/wallets/${customerId}`,
  ]) {
    r = await call('GET', path);
    check(`GET ${path.split('?')[0]} sin token => 401`, r.status === 401, `${r.status} ${JSON.stringify(r.json)}`);
  }

  console.log('\n[sesión del personal no es sesión de cliente]');
  r = await call('POST', '/auth/login', { body: ADMIN });
  check('login del super admin', r.status === 200 && r.data?.accessToken, JSON.stringify(r.json));
  const adminAccess = r.data.accessToken;
  const adminRefresh = r.data.refreshToken;

  r = await call('GET', '/auth/me', { token: adminAccess });
  check(
    'el token del personal trae rol de backoffice, no un customerId',
    r.data?.roles?.includes('SUPER_ADMIN') && r.data.customerId === undefined && r.data.email === ADMIN.email,
    JSON.stringify(r.json),
  );

  r = await call('GET', '/auth/me', { token: adminRefresh });
  check('refresh token no sirve como sesión', r.status === 401, JSON.stringify(r.json));

  r = await call('POST', '/auth/2fa/setup', { token: adminAccess });
  const adminSecret = r.data?.secret;
  check('setup 2FA del admin', !!adminSecret, JSON.stringify(r.json));
  r = await call('POST', '/auth/2fa/enable', {
    token: adminAccess,
    body: { code: authenticator.generate(adminSecret) },
  });
  check('enable 2FA del admin', r.data?.enabled === true, JSON.stringify(r.json));

  r = await call('POST', '/auth/login', { body: ADMIN });
  const twoFactorToken = r.data?.twoFactorToken;
  check('login con 2FA no entrega access token', r.data?.requiresTwoFactor === true && !r.data.accessToken);
  r = await call('GET', '/auth/me', { token: twoFactorToken });
  check('token temporal de 2FA no abre el panel', r.status === 401, JSON.stringify(r.json));
  r = await call('GET', `/transactions?customerId=${customerId}`, { token: twoFactorToken });
  check('token de 2FA no lee transacciones de un cliente', r.status === 401, JSON.stringify(r.json));

  r = await call('POST', '/auth/2fa/verify', {
    body: { twoFactorToken, code: authenticator.generate(adminSecret) },
  });
  const superToken = r.data?.accessToken;
  check('verify 2FA del super admin', !!superToken, JSON.stringify(r.json));

  const forgedPayload = {
    sub: customerId,
    email: 'cliente@exchange.com',
    type: 'access',
    roles: ['SUPER_ADMIN'],
    permissions: [],
    twoFactorVerified: true,
  };
  r = await call('GET', '/auth/me', { token: signHs256(forgedPayload, 'secreto-de-cliente') });
  check('JWT firmado con otro secreto => 401', r.status === 401, JSON.stringify(r.json));
  const noneHeader = b64url({ alg: 'none', typ: 'JWT' });
  r = await call('GET', '/wallets', { token: `${noneHeader}.${b64url(forgedPayload)}.` });
  check('JWT alg=none => 401', r.status === 401, JSON.stringify(r.json));

  console.log('\n[un admin no escala a super admin ni opera como el cliente]');
  r = await call('POST', '/users', {
    token: superToken,
    body: {
      email: 'maria.admin@exchange.com',
      firstName: 'María',
      lastName: 'Admin',
      password: STAFF_PASSWORD,
      roles: ['ADMIN'],
    },
  });
  check('super admin crea un ADMIN', r.status === 201 && r.data?.roles?.includes('ADMIN'), JSON.stringify(r.json));
  check('la respuesta no trae passwordHash', r.data && !('passwordHash' in r.data));

  r = await call('POST', '/auth/login', {
    body: { email: 'maria.admin@exchange.com', password: STAFF_PASSWORD },
  });
  const adminStaffToken = r.data?.accessToken;
  check('ADMIN entra sin 2FA', !!adminStaffToken, JSON.stringify(r.json));

  r = await call('POST', '/users', {
    token: adminStaffToken,
    body: {
      email: 'otro.admin@exchange.com',
      firstName: 'Otro',
      lastName: 'Admin',
      password: STAFF_PASSWORD,
      roles: ['SUPER_ADMIN'],
    },
  });
  check('ADMIN sin 2FA no crea usuarios', r.status === 403, JSON.stringify(r.json));

  r = await call('POST', '/auth/2fa/setup', { token: adminStaffToken });
  const staffSecret = r.data?.secret;
  r = await call('POST', '/auth/2fa/enable', {
    token: adminStaffToken,
    body: { code: authenticator.generate(staffSecret) },
  });
  check('ADMIN activa 2FA', r.data?.enabled === true, JSON.stringify(r.json));

  r = await call('POST', '/auth/login', {
    body: { email: 'maria.admin@exchange.com', password: STAFF_PASSWORD },
  });
  r = await call('POST', '/auth/2fa/verify', {
    body: { twoFactorToken: r.data.twoFactorToken, code: authenticator.generate(staffSecret) },
  });
  const adminVerified = r.data?.accessToken;
  check('ADMIN verifica 2FA', !!adminVerified, JSON.stringify(r.json));

  r = await call('POST', '/users', {
    token: adminVerified,
    body: {
      email: 'falso.super@exchange.com',
      firstName: 'Falso',
      lastName: 'Super',
      password: STAFF_PASSWORD,
      roles: ['SUPER_ADMIN'],
    },
  });
  check('ADMIN con 2FA no puede crear un SUPER_ADMIN', r.status === 403, JSON.stringify(r.json));

  r = await call('POST', '/users', {
    token: adminVerified,
    body: {
      email: 'sofia.support@exchange.com',
      firstName: 'Sofía',
      lastName: 'Soporte',
      password: STAFF_PASSWORD,
      roles: ['SUPPORT'],
    },
  });
  const supportId = r.data?.id;
  check('ADMIN sí puede crear SUPPORT', r.status === 201, JSON.stringify(r.json));

  r = await call('PUT', `/users/${supportId}/roles`, {
    token: adminVerified,
    body: { roles: ['SUPER_ADMIN'] },
  });
  check('ADMIN no reasigna roles', r.status === 403, JSON.stringify(r.json));

  r = await call('POST', '/auth/login', {
    body: { email: 'sofia.support@exchange.com', password: STAFF_PASSWORD },
  });
  const supportToken = r.data?.accessToken;
  check('SUPPORT entra', !!supportToken, JSON.stringify(r.json));
  r = await call('GET', `/transactions?customerId=${customerId}`, { token: supportToken });
  check('SUPPORT puede consultar transacciones (es personal de lectura)', r.status === 200, JSON.stringify(r.json));
  r = await call('POST', `/transactions/${customerId}/decision`, {
    token: supportToken,
    body: { decision: 'APPROVE' },
  });
  check('SUPPORT no aprueba una transacción del cliente', r.status === 403, JSON.stringify(r.json));
  r = await call('PATCH', `/wallets/${customerId}/freeze`, {
    token: supportToken,
    body: { frozen: true },
  });
  check('SUPPORT no congela la wallet del cliente', r.status === 403, JSON.stringify(r.json));
  r = await call('POST', `/kyc/submissions/${customerId}/review`, {
    token: supportToken,
    body: { status: 'APPROVED' },
  });
  check('SUPPORT no revisa el KYC del cliente', r.status === 403, JSON.stringify(r.json));

  console.log(`\nRESULTADO: ${passed} OK, ${failed} fallos`);
  if (failed) console.log(logs.split('\n').slice(-40).join('\n'));
} catch (error) {
  failed++;
  console.error('ERROR:', error);
  console.log(logs.split('\n').slice(-40).join('\n'));
} finally {
  server?.kill();
  await repl.stop();
  process.exit(failed ? 1 : 0);
}
