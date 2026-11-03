// El rol SUPPORT lee usuarios y no puede crearlos. Sin token, la ruta es 401.
//   node test/auth-customer-boundary.mjs
import { SUPPORT, call, reporter } from './live-api.mjs';

const { check, finish } = reporter();

const anonymous = await call('GET', '/users');
check('sin token', anonymous.status === 401, JSON.stringify(anonymous.json));

const login = await call('POST', '/auth/login', { body: SUPPORT });
const token = login.data?.accessToken;
check('login soporte', login.status === 200 && !!token, JSON.stringify(login.json));

const listed = await call('GET', '/users', { token });
check('soporte lee', listed.status === 200, JSON.stringify(listed.json));

const created = await call('POST', '/users', {
  token,
  body: {
    email: 'otro@exchange.com',
    firstName: 'Otro',
    lastName: 'Usuario',
    password: 'Cambio-Seguro-1',
    roles: ['SUPPORT'],
  },
});
const message = Array.isArray(created.json?.message) ? created.json.message.join(' ') : String(created.json?.message ?? '');
check('soporte no crea', created.status === 403 && message.includes('Permisos insuficientes'), JSON.stringify(created.json));

finish('Límite de permisos');
