import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('versioned game scripts resolve from the offline cache', async () => {
  const handlers = {};
  let networkRequests = 0;
  let precached = [];
  const cached = {body: 'game code'};
  const context = {
    self: {
      location: {origin: 'https://prisma.example'},
      addEventListener(name, handler) { handlers[name] = handler; },
      skipWaiting() {}
    },
    caches: {open: async () => ({
      addAll: async files => { precached = Array.from(files); },
      match: async (request, options) =>
        request.url.endsWith('/app.js?v=19') && options?.ignoreSearch ? cached : null
    })},
    fetch: async () => { networkRequests++; throw new Error('offline'); },
    URL
  };
  runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
  let installation;
  handlers.install({waitUntil(promise) { installation = promise; }});
  await installation;
  for (const asset of ['./gem-atlas.webp', './burst-atlas.webp', './cross-atlas.webp', './spectrum-gem.webp', './prisma-bg.jpg', './sound.js'])
    assert.ok(precached.includes(asset), `${asset} should be available offline`);
  let response;
  handlers.fetch({request: {method: 'GET', url: 'https://prisma.example/app.js?v=19'},
    respondWith(promise) { response = promise; }});
  assert.equal(await response, cached);
  assert.equal(networkRequests, 0);
});
