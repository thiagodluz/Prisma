import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('every recording requested by Zen is served locally by the Android WebView', () => {
  const zen = readFileSync(new URL('../zen.js', import.meta.url), 'utf8');
  const activity = readFileSync(new URL('../android/app/src/main/java/com/thiagodluz/prisma/MainActivity.java', import.meta.url), 'utf8');
  const routes = new Map([...activity.matchAll(/TYPES\.put\("([^"]+)", "([^"]+)"\)/g)]
    .map(([, path, type]) => [path, type]));
  const recordings = [...zen.matchAll(/src: '(audio\/[^']+)'/g)].map(([, path]) => path);
  assert.equal(recordings.length, 9);
  for (const path of recordings) {
    assert.equal(routes.get(path), path.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg',
      `${path} must resolve from APK assets instead of falling through to the network`);
  }
});
