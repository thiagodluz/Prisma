const CACHE = 'prisma-v1.4.2-afa481032e';
const FILES = ['./', './index.html', './style.css', './app.js', './engine.js', './zen.js', './sound.js',
  './gem-atlas.webp', './burst-atlas.webp', './cross-atlas.webp', './spectrum-gem.webp', './prisma-bg.jpg',
  './audio/music/magic-puzzle.ogg', './audio/music/cozy-puzzle.ogg', './audio/music/space-city.ogg',
  './audio/ambience/stream.mp3', './audio/ambience/rain-soft.ogg', './audio/ambience/forest-cicadas.ogg',
  './audio/ambience/rainforest.mp3', './audio/ambience/rain-thunder.ogg', './audio/ambience/soft-noise.ogg',
  './icon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new Request(file, {cache: 'reload'})))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const obsolete = (await caches.keys()).filter(key => key.startsWith('prisma-v') && key !== CACHE);
  await Promise.all(obsolete.map(key => caches.delete(key)));
  await self.clients.claim();
  // Older pages have no controllerchange listener. Refresh them once during
  // an upgrade; their existing pagehide handler preserves the current game.
  // First installation keeps the page open without a reload.
  if (obsolete.length) {
    const pages = await self.clients.matchAll({type: 'window'});
    // A navigation's fetch waits for activation. Do not await navigation here,
    // or the activation and the refresh would wait for each other indefinitely.
    for (const page of pages) page.navigate(page.url).catch(() => {});
  }
})()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request, {ignoreSearch: true})).then(hit => hit || fetch(event.request)));
});
