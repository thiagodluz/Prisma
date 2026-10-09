import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('versioned game scripts resolve from the offline cache', async () => {
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;
  const handlers = {};
  let networkRequests = 0;
  let precached = [];
  let requestModes = [];
  const cached = {body: 'game code'};
  const context = {
    self: {
      location: {origin: 'https://prisma.example'},
      addEventListener(name, handler) { handlers[name] = handler; },
      skipWaiting() {}
    },
    caches: {open: async () => ({
      addAll: async files => {
        precached = Array.from(files, file => file.url);
        requestModes = Array.from(files, file => file.cache);
      },
      match: async (request, options) =>
        request.url.endsWith(`/app.js?v=${version}`) && options?.ignoreSearch ? cached : null
    })},
    fetch: async () => { networkRequests++; throw new Error('offline'); },
    URL,
    Request: class { constructor(url, init) { this.url = url; this.cache = init?.cache; } }
  };
  runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
  let installation;
  handlers.install({waitUntil(promise) { installation = promise; }});
  await installation;
  for (const asset of ['./gem-atlas.webp', './burst-atlas.webp', './cross-atlas.webp', './spectrum-gem.webp', './prisma-bg.jpg', './sound.js',
    './audio/music/magic-puzzle.ogg', './audio/music/cozy-puzzle.ogg', './audio/music/space-city.ogg',
    './audio/ambience/stream.mp3', './audio/ambience/rain-soft.ogg', './audio/ambience/forest-cicadas.ogg',
    './audio/ambience/rainforest.mp3', './audio/ambience/rain-thunder.ogg', './audio/ambience/soft-noise.ogg'])
    assert.ok(precached.includes(asset), `${asset} should be available offline`);
  assert.ok(requestModes.length && requestModes.every(mode => mode === 'reload'));
  let response;
  handlers.fetch({request: {method: 'GET', url: `https://prisma.example/app.js?v=${version}`},
    respondWith(promise) { response = promise; }});
  assert.equal(await response, cached);
  assert.equal(networkRequests, 0);
});

test('standalone HTML embeds every approved music and ambience recording', () => {
  const standalone = readFileSync(new URL('../Prisma-jogar-offline.html', import.meta.url), 'utf8');
  for (const file of ['audio/music/magic-puzzle.ogg', 'audio/music/cozy-puzzle.ogg',
    'audio/music/space-city.ogg', 'audio/ambience/stream.mp3', 'audio/ambience/rain-soft.ogg',
    'audio/ambience/forest-cicadas.ogg', 'audio/ambience/rainforest.mp3', 'audio/ambience/rain-thunder.ogg', 'audio/ambience/soft-noise.ogg']) {
    const bytes = readFileSync(new URL(`../${file}`, import.meta.url));
    const mime = file.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg';
    assert.ok(standalone.includes(`data:${mime};base64,${bytes.toString('base64')}`),
      `${file} should be embedded without a network dependency`);
  }
});
