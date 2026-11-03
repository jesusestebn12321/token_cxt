// Registro público y recuperación de contraseña contra la API levantada.
//   node test/auth-account.mjs
import { call, reporter } from './live-api.mjs';

const { check, finish } = reporter();
const email = `registro.${Date.now()}@exchange.com`;
const password = 'ChangeMe!Registro1';
const nextPassword = 'ChangeMe!Reset1';

const created = await call('POST', '/auth/register', {
  body: { email, firstName: 'Registro', lastName: 'Prueba', password },
});
check(
  'registro sin roles',
  created.status === 201 && created.data?.email === email && Array.isArray(created.data?.roles) && created.data.roles.length === 0,
  JSON.stringify(created.json),
);

const duplicate = await call('POST', '/auth/register', {
  body: { email, firstName: 'Registro', lastName: 'Prueba', password },
});
check('email repetido', duplicate.status === 409, JSON.stringify(duplicate.json));

const login = await call('POST', '/auth/login', { body: { email, password } });
const token = login.data?.accessToken;
check('login de la cuenta nueva', login.status === 200 && !!token, JSON.stringify(login.json));

const listed = await call('GET', '/users', { token });
check('sin permiso de usuarios', listed.status === 403, JSON.stringify(listed.json));

const forgot = await call('POST', '/auth/forgot-password', { body: { email } });
const resetToken = forgot.data?.resetToken;
check(
  'recuperación aceptada',
  forgot.status === 200 && forgot.data?.accepted === true && typeof resetToken === 'string' && resetToken.length > 20,
  JSON.stringify(forgot.json),
);

const unknown = await call('POST', '/auth/forgot-password', { body: { email: 'nadie@exchange.com' } });
check(
  'email inexistente no revela token',
  unknown.status === 200 && unknown.data?.accepted === true && unknown.data?.resetToken === undefined,
  JSON.stringify(unknown.json),
);

const reset = await call('POST', '/auth/reset-password', { body: { token: resetToken, password: nextPassword } });
check('contraseña restablecida', reset.status === 200 && reset.data?.reset === true, JSON.stringify(reset.json));

const reused = await call('POST', '/auth/reset-password', { body: { token: resetToken, password: 'ChangeMe!Otra1' } });
check('token de un solo uso', reused.status === 400, JSON.stringify(reused.json));

const oldLogin = await call('POST', '/auth/login', { body: { email, password } });
check('clave anterior rechazada', oldLogin.status === 401, JSON.stringify(oldLogin.json));

const newLogin = await call('POST', '/auth/login', { body: { email, password: nextPassword } });
check('login con la clave nueva', newLogin.status === 200 && !!newLogin.data?.accessToken, JSON.stringify(newLogin.json));

finish('Registro y recuperación');
