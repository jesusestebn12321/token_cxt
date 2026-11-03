import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const seedSource = readFileSync(new URL('./src/database/seeds/run-seed.ts', root), 'utf8');
const usersSource = readFileSync(new URL('./src/database/seeds/users.seed.ts', root), 'utf8');

function readConst(source, name) {
  const match = source.match(new RegExp(`const ${name} = '([^']+)'`));
  if (!match) throw new Error(`No se encontró ${name} en el seeder`);
  return match[1];
}

export const BASE = `${process.env.API_URL ?? 'http://localhost:3000'}/api/v1`;
export const ADMIN = {
  email: readConst(seedSource, 'SEED_ADMIN_EMAIL'),
  password: readConst(seedSource, 'SEED_ADMIN_PASSWORD'),
};
export const SUPPORT = {
  email: 'sofia.support@exchange.com',
  password: readConst(usersSource, 'DEMO_USER_PASSWORD'),
};

if (!usersSource.includes(SUPPORT.email)) {
  throw new Error(`El seeder ya no crea ${SUPPORT.email}`);
}

export const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data, json };
};

export function reporter() {
  let failed = 0;
  const check = (name, ok, extra = '') => {
    if (!ok) failed += 1;
    console.log(`${ok ? '  OK ' : '  FAIL'} ${name}${ok ? '' : ` ${extra}`}`);
  };
  return {
    check,
    finish(label) {
      console.log(failed ? `\n${failed} FALLOS en ${label}` : `\n${label} OK`);
      process.exit(failed ? 1 : 0);
    },
  };
}
