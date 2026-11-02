import { spawn } from 'node:child_process';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const PORT = 3055;
const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
const uri = repl.getUri('rwa_test');
console.log('URI', uri);
console.log('NODE_OPTIONS', process.env.NODE_OPTIONS ?? '(none)');

const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: String(PORT),
  MONGODB_URI: uri,
  SWAGGER_ENABLED: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  THROTTLE_LIMIT: '1000',
};
delete env.NODE_OPTIONS;

const server = spawn(process.execPath, ['dist/apps/api-gateway/main.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', (d) => process.stdout.write(`[out] ${d}`));
server.stderr.on('data', (d) => process.stderr.write(`[err] ${d}`));
server.on('exit', (code, signal) => console.log('SERVER EXIT', code, signal));

const paths = ['/api/docs-json', '/api/docs', '/api/v1/health/live', '/api/health/live'];
for (let i = 0; i < 25; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  if (server.exitCode !== null) break;
  for (const path of paths) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
      console.log(`TRY ${path} -> ${res.status}`);
      if (res.ok) {
        console.log('READY', path);
        server.kill();
        await repl.stop();
        process.exit(0);
      }
    } catch (e) {
      console.log(`TRY ${path} -> ${e.cause?.code ?? e.message}`);
    }
  }
}

console.log('NOT READY, exitCode', server.exitCode);
server.kill();
await repl.stop();
process.exit(1);
