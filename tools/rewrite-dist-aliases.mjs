import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve('dist');
const commonRoot = path.join(distRoot, 'libs', 'common');

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (full.endsWith('.js')) rewrite(full);
  }
}

function rewrite(file) {
  const source = readFileSync(file, 'utf8');
  const next = source.replace(/@app\/common(?:\/([A-Za-z0-9_./-]+))?/g, (_match, spec) => {
    const target = spec ? path.join(commonRoot, spec) : path.join(commonRoot, 'index');
    let relative = path.relative(path.dirname(file), target).replaceAll('\\', '/');
    if (!relative.startsWith('.')) relative = `./${relative}`;
    return relative.endsWith('.js') ? relative : `${relative}.js`;
  });
  if (next !== source) writeFileSync(file, next);
}

const appsDir = path.join(distRoot, 'apps');
walk(appsDir);
