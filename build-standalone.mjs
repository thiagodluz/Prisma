import {readFileSync, writeFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const dataUrl = (file, mime) => `data:${mime};base64,${readFileSync(new URL(file, import.meta.url)).toString('base64')}`;
const replace = (source, pattern, value, label) => {
  if (!pattern.test(source)) throw new Error(`Não foi possível incorporar ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, value);
};
let css = read('style.css');
for (const [file, mime] of [
  ['gem-atlas.webp', 'image/webp'], ['burst-atlas.webp', 'image/webp'],
  ['cross-atlas.webp', 'image/webp'], ['spectrum-gem.webp', 'image/webp'],
  ['prisma-bg.jpg', 'image/jpeg']
]) css = replace(css, new RegExp(`url\\(['"]?${file.replace('.', '\\.')}['"]?\\)`, 'g'),
  `url(${dataUrl(file, mime)})`, file);

let js = read('engine.js');
js = replace(js, /export const /g, 'const ', 'exports da engine');
js = replace(js, /export class /g, 'class ', 'classe da engine');
for (const file of ['zen.js', 'sound.js']) {
  let module = read(file);
  module = replace(module, /export (const|function|class) /g, '$1 ', `exports de ${file}`);
  js += '\n' + module;
}
let app = read('app.js');
for (const file of ['engine.js', 'zen.js', 'sound.js'])
  app = replace(app, new RegExp(`^import \\{[^}]+\\} from '\\./${file.replace('.', '\\.')}\\?v=[^']+';\\r?\\n`, 'm'), '', `import de ${file}`);
app = replace(app, /if \(!new URLSearchParams\(globalThis\.location\?\.search \?\? ''\)\.has\('android'\) && 'serviceWorker' in navigator\)\s+navigator\.serviceWorker\.register\('\.\/sw\.js'\)\.catch\(\(\) => \{\}\);/, '', 'registro do Service Worker');
js += '\n' + app;
new Script(js, {filename: 'Prisma-jogar-offline.html'});

let html = read('index.html');
for (const pattern of [/<link rel="manifest"[^>]+>\s*/, /<link rel="icon"[^>]+>\s*/,
  ...['gem-atlas.webp', 'burst-atlas.webp', 'cross-atlas.webp', 'spectrum-gem.webp']
    .map(file => new RegExp(`<link rel="preload" href="${file}"[^>]+>\\s*`))])
  html = replace(html, pattern, '', String(pattern));
html = replace(html, /<link rel="stylesheet" href="style\.css\?v=[^"]+">/, `<style>${css}</style>`, 'CSS');
html = replace(html, /<script type="module" src="app\.js\?v=[^"]+"><\/script>/,
  `<script>${js}</script>`, 'JavaScript');

const output = new URL('Prisma-jogar-offline.html', import.meta.url);
if (process.argv.includes('--check')) {
  if (read('Prisma-jogar-offline.html') !== html)
    throw new Error('HTML offline desatualizado; rode npm run build:offline');
} else writeFileSync(output, html);
