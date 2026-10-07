import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const origin = 'https://prisma-jogo-thiago.thiagodluz.chatgpt.site/';
const assets = {
  'audio/music/magic-puzzle.ogg': 'f94f4a6f895f22669dd5ced4061f932e1b5335e40e36d1e94fe7cfc222a4c2b8',
  'audio/music/cozy-puzzle.ogg': '56551121c11db983564106fbc199ed647a555e3e798501f3c6847c29278ebe37',
  'audio/music/space-city.ogg': '6ecb8408cd84b1031425e8f1b941d7a89ab8a850cea2833ac2e005f76544d7a7',
  'audio/ambience/stream.mp3': '3bb152c08d3646faf3f09c2bcfd0f17a31ad962699258b55c56ccf4735fee7d8',
  'audio/ambience/rain.ogg': '4f659f68cf5219007d0bb0969a1862491ceee4057fda4c491c6001e8608fa2cb',
  'audio/ambience/forest.mp3': '9850aa1d0d5d66bd9c5daf8bb77c6d852e01f2f4de22f283bd5621e8bed13b75',
  'audio/ambience/rainforest.mp3': '3fb52816724ddab1b4af2c6c2106965595e228af38133b4eef4a3a6552980e10'
};

for (const [path, expected] of Object.entries(assets)) {
  const destination = resolve(path);
  try {
    if (createHash('sha256').update(readFileSync(destination)).digest('hex') === expected) continue;
  } catch { /* Fetch a missing bundled file. */ }
  const response = await fetch(new URL(path, origin));
  if (!response.ok) throw new Error(`Falha ao baixar ${path}: HTTP ${response.status}`);
  const content = Buffer.from(await response.arrayBuffer());
  const actual = createHash('sha256').update(content).digest('hex');
  if (actual !== expected) throw new Error(`SHA-256 inválido para ${path}: ${actual}`);
  mkdirSync(dirname(destination), {recursive: true});
  const temporary = `${destination}.download`;
  writeFileSync(temporary, content);
  renameSync(temporary, destination);
}

console.log(`Áudios CC0 verificados: ${Object.keys(assets).length}`);
