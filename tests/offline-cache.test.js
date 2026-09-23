import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('versioned game scripts resolve from the offline cache', async () => {
  const handlers = {};
  let networkRequests = 0;
  const cached = {body: 'game code'};
  const context = {
    self: {
      location: {origin: 'https://prisma.example'},
      addEventListener(name, handler) { handlers[name] = handler; }
    },
    caches: {open: async () => ({
      match: async (request, options) =>
        request.url.endsWith('/app.js?v=8') && options?.ignoreSearch ? cached : null
    })},
    fetch: async () => { networkRequests++; throw new Error('offline'); },
    URL
  };
  runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
  let response;
  handlers.fetch({request: {method: 'GET', url: 'https://prisma.example/app.js?v=8'},
    respondWith(promise) { response = promise; }});
  assert.equal(await response, cached);
  assert.equal(networkRequests, 0);
});
