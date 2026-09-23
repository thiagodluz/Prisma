import {readFileSync, writeFileSync} from 'node:fs';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const html = read('index.html')
  .replace('<link rel="manifest" href="manifest.webmanifest">', '')
  .replace('<link rel="icon" href="icon.svg" type="image/svg+xml">', '')
  .replace('<link rel="stylesheet" href="style.css?v=3">', `<style>${read('style.css')}</style>`)
  .replace('<script type="module" src="app.js?v=3"></script>',
    `<script>${read('engine.js').replaceAll('export const ', 'const ').replace('export class ', 'class ')}\n${read('app.js').replace("import {Game, SIZE} from './engine.js?v=3';", '').replace("if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});", '')}</script>`);
writeFileSync(new URL('Prisma-jogar-offline.html', import.meta.url), html);
