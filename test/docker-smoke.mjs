// Pruebas contra el stack ya levantado: docker compose up -d && seed.
//   node test/docker-smoke.mjs
import { ADMIN, SUPPORT, call, reporter } from './live-api.mjs';

const { check, finish } = reporter();

let health = await call('GET', '/health/live');
check('health live', health.status === 200 && health.data?.status === 'ok', JSON.stringify(health.json));

health = await call('GET', '/health');
check('health ready (MongoDB)', health.status === 200 && health.data?.database === 'up', JSON.stringify(health.json));

let denied = await call('GET', '/users');
check('usuarios sin token', denied.status === 401, JSON.stringify(denied.json));

let bad = await call('POST', '/auth/login', { body: { email: ADMIN.email, password: 'incorrecta-pass' } });
check('login inválido', bad.status === 401 && bad.json?.success === false, JSON.stringify(bad.json));

let login = await call('POST', '/auth/login', { body: ADMIN });
const token = login.data?.accessToken;
check('login super admin', login.status === 200 && login.data?.requiresTwoFactor === false && !!token, JSON.stringify(login.json));

let me = await call('GET', '/auth/me', { token });
check(
  'perfil SUPER_ADMIN',
  me.status === 200 && me.data?.email === ADMIN.email && me.data?.roles?.includes('SUPER_ADMIN') && me.data?.twoFactorVerified === false,
  JSON.stringify(me.json),
);

let users = await call('GET', '/users?page=1&limit=20', { token });
check(
  'listado de usuarios',
  users.status === 200 && users.data?.total >= 7 && users.data.items.some((item) => item.email === ADMIN.email),
  JSON.stringify(users.json),
);

let roles = await call('GET', '/roles', { token });
const names = Array.isArray(roles.data) ? roles.data.map((item) => item.name) : [];
check(
  'roles del seed',
  roles.status === 200 && ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'OPERATIONS', 'COMPLIANCE_OFFICER', 'TREASURY', 'AUDITOR'].every((name) => names.includes(name)),
  JSON.stringify(roles.json),
);

let catalog = await call('GET', '/roles/catalog', { token });
check('catálogo users', catalog.status === 200 && catalog.data?.modules?.[0]?.key === 'users', JSON.stringify(catalog.json));

const adminId = me.data?.id;
let detail = await call('GET', `/users/${adminId}`, { token });
check('detalle de usuario', detail.status === 200 && detail.data?.email === ADMIN.email, JSON.stringify(detail.json));

let create = await call('POST', '/users', {
  token,
  body: {
    email: 'ops@exchange.com',
    firstName: 'Ana',
    lastName: 'Pérez',
    password: 'Cambio-Seguro-1',
    roles: ['OPERATIONS'],
  },
});
const createMessage = Array.isArray(create.json?.message) ? create.json.message.join(' ') : String(create.json?.message ?? '');
check('alta de usuario exige 2FA', create.status === 403 && createMessage.includes('dos factores'), JSON.stringify(create.json));

const supportLogin = await call('POST', '/auth/login', { body: SUPPORT });
const supportToken = supportLogin.data?.accessToken;
check('login soporte', supportLogin.status === 200 && !!supportToken, JSON.stringify(supportLogin.json));

const supportUsers = await call('GET', '/users', { token: supportToken });
check('soporte lee usuarios', supportUsers.status === 200, JSON.stringify(supportUsers.json));

const supportCreate = await call('POST', '/users', {
  token: supportToken,
  body: {
    email: 'otro@exchange.com',
    firstName: 'Otro',
    lastName: 'Usuario',
    password: 'Cambio-Seguro-1',
    roles: ['SUPPORT'],
  },
});
const supportMessage = Array.isArray(supportCreate.json?.message) ? supportCreate.json.message.join(' ') : String(supportCreate.json?.message ?? '');
check('soporte no crea usuarios', supportCreate.status === 403 && supportMessage.includes('Permisos insuficientes'), JSON.stringify(supportCreate.json));

finish('Docker smoke');
