import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (full.endsWith('.ts') || full.endsWith('.mjs')) acc.push(full);
  }
  return acc;
}

const hits = [];
for (const file of walk(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  if (/mongoose|@nestjs\/mongoose|InjectModel|@Schema\(|@Prop\(/.test(text)) hits.push(file);
}
if (hits.length) {
  console.log('Quedan referencias a Mongoose:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('smoke: sin referencias a Mongoose en src');
