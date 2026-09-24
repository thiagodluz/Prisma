import {readFileSync, writeFileSync} from 'node:fs';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const dataUrl = (file, mime) => `data:${mime};base64,${readFileSync(new URL(file, import.meta.url)).toString('base64')}`;
const css = read('style.css')
  .replaceAll("url('gem-atlas.webp')", `url(${dataUrl('gem-atlas.webp', 'image/webp')})`)
  .replaceAll("url('burst-atlas.webp')", `url(${dataUrl('burst-atlas.webp', 'image/webp')})`)
  .replaceAll("url('cross-atlas.webp')", `url(${dataUrl('cross-atlas.webp', 'image/webp')})`)
  .replaceAll("url('spectrum-gem.webp')", `url(${dataUrl('spectrum-gem.webp', 'image/webp')})`)
  .replaceAll("url('prisma-bg.jpg')", `url(${dataUrl('prisma-bg.jpg', 'image/jpeg')})`);
const html = read('index.html')
  .replace('<link rel="manifest" href="manifest.webmanifest">', '')
  .replace('<link rel="icon" href="icon.svg" type="image/svg+xml">', '')
  .replace('<link rel="preload" href="gem-atlas.webp" as="image">', '')
  .replace('<link rel="preload" href="burst-atlas.webp" as="image">', '')
  .replace('<link rel="preload" href="cross-atlas.webp" as="image">', '')
  .replace('<link rel="preload" href="spectrum-gem.webp" as="image">', '')
  .replace('<link rel="stylesheet" href="style.css?v=19">', `<style>${css}</style>`)
  .replace('<script type="module" src="app.js?v=19"></script>',
    `<script>${read('engine.js').replaceAll('export const ', 'const ').replace('export class ', 'class ')}\n${read('zen.js').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ').replace('export class ', 'class ')}\n${read('sound.js').replace('export const AUDIO_DEFAULTS', 'const AUDIO_DEFAULTS').replace('export function normalizeAudioSettings', 'function normalizeAudioSettings').replace('export class ', 'class ').replace('export function ', 'function ')}\n${read('app.js').replace("import {Game, SIZE, levelGoal} from './engine.js?v=19';", '').replace("import {ZenAudio, normalizeZenSettings, breathTiming} from './zen.js?v=19';", '').replace("import {SoundDesign, normalizeAudioSettings, cueForFrame} from './sound.js?v=19';", '').replace("if (!new URLSearchParams(globalThis.location?.search ?? '').has('android') && 'serviceWorker' in navigator)\n  navigator.serviceWorker.register('./sw.js').catch(() => {});", '')}</script>`);
writeFileSync(new URL('Prisma-jogar-offline.html', import.meta.url), html);
