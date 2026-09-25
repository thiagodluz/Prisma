import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cachedFiles} from './cache-assets.mjs';
import {versionCodeFor} from './version-code.mjs';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;
const versionCode = versionCodeFor(version);
const check = process.argv.includes('--check');
const files = [
  ['../index.html', /(style\.css|app\.js)\?v=[\w.-]+/g, (_, file) => `${file}?v=${version}`],
  ['../app.js', /(engine\.js|zen\.js|sound\.js)\?v=[\w.-]+/g, (_, file) => `${file}?v=${version}`],
  ['../android/app/build.gradle', /versionName '[^']+'/g, () => `versionName '${version}'`],
  ['../android/app/build.gradle', /versionCode \d+/g, () => `versionCode ${versionCode}`]
];
for (const [path, pattern, replacement] of files) {
  const url = new URL(path, import.meta.url);
  const original = readFileSync(url, 'utf8');
  if (!original.match(pattern)) throw new Error(`Marcador de versão ausente em ${path}`);
  const updated = original.replace(pattern, replacement);
  if (check && updated !== original) throw new Error(`Versão divergente em ${path}; rode npm run sync:version`);
  if (!check && updated !== original) writeFileSync(url, updated);
}

// Read the precache manifest from the worker itself so the hash cannot omit an asset.
const worker = new URL('../sw.js', import.meta.url);
const originalWorker = readFileSync(worker, 'utf8');
const hash = createHash('sha256');
for (const file of cachedFiles(originalWorker)) {
  hash.update(file).update('\0').update(readFileSync(new URL(`../${file}`, import.meta.url))).update('\0');
}
const cache = `prisma-v${version}-${hash.digest('hex').slice(0, 10)}`;
const marker = /const CACHE = 'prisma-v[^']+';/;
if (!marker.test(originalWorker)) throw new Error('Nome do cache ausente');
const updatedWorker = originalWorker.replace(marker, `const CACHE = '${cache}';`);
if (check && updatedWorker !== originalWorker) throw new Error('Cache desatualizado; rode npm run sync:version');
if (!check && updatedWorker !== originalWorker) writeFileSync(worker, updatedWorker);
