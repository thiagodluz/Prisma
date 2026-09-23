const CACHE = 'prisma-v11';
const FILES = ['./', './index.html', './style.css', './app.js', './engine.js', './zen.js', './sound.js',
  './gem-atlas.webp', './special-atlas.webp', './prisma-bg.jpg',
  './icon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request, {ignoreSearch: true})).then(hit => hit || fetch(event.request)));
});
