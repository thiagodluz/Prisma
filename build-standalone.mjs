import {readFileSync, writeFileSync} from 'node:fs';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const dataUrl = (file, mime) => `data:${mime};base64,${readFileSync(new URL(file, import.meta.url)).toString('base64')}`;
const css = read('style.css')
  .replaceAll("url('gem-atlas.webp')", `url(${dataUrl('gem-atlas.webp', 'image/webp')})`)
  .replaceAll("url('special-atlas.webp')", `url(${dataUrl('special-atlas.webp', 'image/webp')})`)
  .replaceAll("url('prisma-bg.jpg')", `url(${dataUrl('prisma-bg.jpg', 'image/jpeg')})`);
const html = read('index.html')
  .replace('<link rel="manifest" href="manifest.webmanifest">', '')
  .replace('<link rel="icon" href="icon.svg" type="image/svg+xml">', '')
  .replace('<link rel="preload" href="gem-atlas.webp" as="image">', '')
  .replace('<link rel="preload" href="special-atlas.webp" as="image">', '')
  .replace('<link rel="stylesheet" href="style.css?v=10">', `<style>${css}</style>`)
  .replace('<script type="module" src="app.js?v=10"></script>',
    `<script>${read('engine.js').replaceAll('export const ', 'const ').replace('export class ', 'class ')}\n${read('zen.js').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ').replace('export class ', 'class ')}\n${read('sound.js').replace('export class ', 'class ').replace('export function ', 'function ')}\n${read('app.js').replace("import {Game, SIZE, levelGoal} from './engine.js?v=10';", '').replace("import {ZenAudio, normalizeZenSettings, breathTiming} from './zen.js?v=10';", '').replace("import {SoundDesign, cueForFrame} from './sound.js?v=10';", '').replace("if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});", '')}</script>`);
writeFileSync(new URL('Prisma-jogar-offline.html', import.meta.url), html);
