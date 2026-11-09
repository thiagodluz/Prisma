import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const assets = {
  'audio/ambience/soft-noise.ogg': '1ce3d836d0b9299058ea711d76b15cc244256ff5accbf3b894c1de134b50b011',
  'audio/ambience/rain-thunder.ogg': 'c2955d257e1e8a9decd115869f28b94f09e864a1098e81f3e05c54d31e933aef',
  'audio/ambience/rain-soft.ogg': 'd80e1d2bdfb2d9956bea305f1529fc0f5ba84417f5e8dbb4b6edc753d1a1a2e4',
  'audio/ambience/forest-cicadas.ogg': '64b1c8391fc8ecb091f03ad485982c0a051fece12e95534a06ffd85ca309f8e2',
  'audio/music/magic-puzzle.ogg': 'f94f4a6f895f22669dd5ced4061f932e1b5335e40e36d1e94fe7cfc222a4c2b8',
  'audio/music/cozy-puzzle.ogg': '56551121c11db983564106fbc199ed647a555e3e798501f3c6847c29278ebe37',
  'audio/music/space-city.ogg': '6ecb8408cd84b1031425e8f1b941d7a89ab8a850cea2833ac2e005f76544d7a7',
  'audio/ambience/stream.mp3': '3bb152c08d3646faf3f09c2bcfd0f17a31ad962699258b55c56ccf4735fee7d8',
  'audio/ambience/rainforest.mp3': '3fb52816724ddab1b4af2c6c2106965595e228af38133b4eef4a3a6552980e10'
};

const missing = new Map();
for (const [path, expected] of Object.entries(assets)) {
  try { if (createHash('sha256').update(readFileSync(resolve(path))).digest('hex') === expected) continue; } catch {}
  missing.set(expected, path);
}
if (missing.size) {
  // The public 1.4.2 release contains all approved recordings, embedded in HTML.
  // Verify every decoded file independently; never depend on the old Site.
  const response = await fetch('https://github.com/thiagodluz/Prisma/releases/download/v1.4.2/Prisma-jogar-offline.html');
  if (!response.ok) throw new Error(`Falha ao recuperar áudios: HTTP ${response.status}`);
  const html = await response.text();
  for (const [, data] of html.matchAll(/data:audio\/(?:ogg|mpeg);base64,([A-Za-z0-9+/=]+)/g)) {
    const bytes = Buffer.from(data, 'base64');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const path = missing.get(hash);
    if (!path) continue;
    const destination = resolve(path);
    mkdirSync(dirname(destination), {recursive: true});
    writeFileSync(destination + '.download', bytes);
    renameSync(destination + '.download', destination);
    missing.delete(hash);
  }
  if (missing.size) throw new Error(`Áudios ausentes ou divergentes: ${[...missing.values()].join(', ')}`);
}
console.log(`Áudios licenciados verificados: ${Object.keys(assets).length}`);
