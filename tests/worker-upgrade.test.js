import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

for (const upgrading of [true, false]) test(upgrading
  ? 'a cache upgrade refreshes already-open legacy pages after claiming them'
  : 'first installation does not reload the game', async () => {
  const worker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const cache = worker.match(/const CACHE = '([^']+)'/)[1];
  const keys = [cache, 'another-app', ...(upgrading ? ['prisma-v1.3.0-old'] : [])];
  const deleted = [];
  const navigated = [];
  const handlers = {};
  let claimed = false;
  runInNewContext(worker, {
    self: {location: {origin: 'https://prisma.example'}, addEventListener: (n, h) => handlers[n] = h,
      clients: {claim: async () => { claimed = true; }, matchAll: async () => [{
        url: 'https://prisma.example/', navigate: async url => {
          assert.equal(claimed, true); navigated.push(url);
        }
      }]}},
    caches: {keys: async () => keys, delete: async key => { deleted.push(key); return true; }},
    URL
  });
  let activated;
  handlers.activate({waitUntil: p => { activated = p; }});
  await activated;
  assert.deepEqual(deleted, upgrading ? ['prisma-v1.3.0-old'] : []);
  assert.deepEqual(navigated, upgrading ? ['https://prisma.example/'] : []);
});

test('activation finishes before an upgraded page waits for its navigation response', async () => {
  const worker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const handlers = {};
  let navigationStarted = false;
  let finishNavigation;
  const navigation = new Promise(resolve => { finishNavigation = resolve; });
  runInNewContext(worker, {
    self: {location: {origin: 'https://prisma.example'}, addEventListener: (n, h) => handlers[n] = h,
      clients: {claim: async () => {}, matchAll: async () => [{url: 'https://prisma.example/',
        navigate: () => { navigationStarted = true; return navigation; }}]}},
    caches: {keys: async () => ['prisma-v1.3.0-old'], delete: async () => true}, URL
  });
  let activated;
  handlers.activate({waitUntil: p => { activated = p; }});
  const completed = await Promise.race([activated.then(() => true),
    new Promise(resolve => setImmediate(() => resolve(false)))]);
  finishNavigation();
  await activated;
  assert.equal(navigationStarted, true);
  assert.equal(completed, true, 'waiting for navigation here deadlocks its fetch until activation completes');
});
