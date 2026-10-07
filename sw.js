const CACHE = 'prisma-v1.4.0-1e2f66ff16';
const FILES = ['./', './index.html', './style.css', './app.js', './engine.js', './zen.js', './sound.js',
  './gem-atlas.webp', './burst-atlas.webp', './cross-atlas.webp', './spectrum-gem.webp', './prisma-bg.jpg',
  './audio/music/magic-puzzle.ogg', './audio/music/cozy-puzzle.ogg', './audio/music/space-city.ogg',
  './audio/ambience/stream.mp3', './audio/ambience/rain.ogg', './audio/ambience/forest.mp3',
  './audio/ambience/rainforest.mp3',
  './icon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new Request(file, {cache: 'reload'})))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('prisma-v') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request, {ignoreSearch: true})).then(hit => hit || fetch(event.request)));
});
