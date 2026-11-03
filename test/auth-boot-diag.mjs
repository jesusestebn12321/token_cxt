// Comprueba que la API levantada responde y que MongoDB está arriba.
//   node test/auth-boot-diag.mjs
import { call, reporter } from './live-api.mjs';

const { check, finish } = reporter();

const live = await call('GET', '/health/live');
check('proceso vivo', live.status === 200 && live.data?.status === 'ok', JSON.stringify(live.json));

const ready = await call('GET', '/health');
check('MongoDB arriba', ready.status === 200 && ready.data?.database === 'up', JSON.stringify(ready.json));

finish('Boot');
