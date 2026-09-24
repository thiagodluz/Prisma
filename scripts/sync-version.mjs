import {readFileSync, writeFileSync} from 'node:fs';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Versão inválida');
const check = process.argv.includes('--check');
const files = [
  ['../index.html', /(style\.css|app\.js)\?v=[\w.-]+/g, (_, file) => `${file}?v=${version}`],
  ['../app.js', /(engine\.js|zen\.js|sound\.js)\?v=[\w.-]+/g, (_, file) => `${file}?v=${version}`],
  ['../sw.js', /const CACHE = 'prisma-v[^']+';/g, () => `const CACHE = 'prisma-v${version}';`],
  ['../android/app/build.gradle', /versionName '[^']+'/g, () => `versionName '${version}'`]
];
for (const [path, pattern, replacement] of files) {
  const url = new URL(path, import.meta.url);
  const original = readFileSync(url, 'utf8');
  if (!original.match(pattern)) throw new Error(`Marcador de versão ausente em ${path}`);
  const updated = original.replace(pattern, replacement);
  if (check && updated !== original) throw new Error(`Versão divergente em ${path}; rode npm run sync:version`);
  if (!check && updated !== original) writeFileSync(url, updated);
}
