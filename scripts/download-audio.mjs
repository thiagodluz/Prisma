import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const origin = 'https://prisma-jogo-thiago.thiagodluz.chatgpt.site/';
// New recordings are fetched from their publisher and pinned by SHA-256.
const sourceUrls = {
  'audio/ambience/forest-cicadas.ogg': 'https://cdn.freesound.org/previews/434/434675_3555174-hq.ogg',
  'audio/ambience/rain-soft.ogg': 'https://cdn.freesound.org/previews/595/595717_2530992-hq.ogg',
  'audio/ambience/rain-thunder.ogg': 'https://cdn.freesound.org/previews/243/243777_997601-hq.ogg',
  'audio/ambience/soft-noise.ogg': 'https://cdn.freesound.org/previews/725/725423_10643461-hq.ogg'
};
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

for (const [path, expected] of Object.entries(assets)) {
  const destination = resolve(path);
  try {
    if (createHash('sha256').update(readFileSync(destination)).digest('hex') === expected) continue;
  } catch { /* Fetch a missing bundled file. */ }
  const response = await fetch(sourceUrls[path] || new URL(path, origin));
  if (!response.ok) throw new Error(`Falha ao baixar ${path}: HTTP ${response.status}`);
  const content = Buffer.from(await response.arrayBuffer());
  const actual = createHash('sha256').update(content).digest('hex');
  if (actual !== expected) throw new Error(`SHA-256 inválido para ${path}: ${actual}`);
  mkdirSync(dirname(destination), {recursive: true});
  const temporary = `${destination}.download`;
  writeFileSync(temporary, content);
  renameSync(temporary, destination);
}

console.log(`Áudios licenciados verificados: ${Object.keys(assets).length}`);
