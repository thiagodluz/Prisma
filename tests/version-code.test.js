import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {versionCodeFor} from '../scripts/version-code.mjs';

test('Android codes increase through betas and final versions', () => {
  const versions = ['1.0.3-beta.2', '1.0.3', '1.0.4-beta.1', '1.0.4', '1.1.0'];
  const codes = versions.map(versionCodeFor);
  assert.deepEqual(codes.slice(0, 4), [1000302, 1000399, 1000401, 1000499]);
  assert.ok(codes.every((code, index) => index === 0 || code > codes[index - 1]));
  for (const invalid of ['1.0.3-rc.1', '1.0.100', '1.100.0', '1.0.3-beta.0',
    '1.0.3-beta.99', '1.0.3-beta.01', '2100.0.0'])
    assert.throws(() => versionCodeFor(invalid), /inválida|limite/);
});

test('check:version rejects a manually changed Android versionCode', () => {
  const root = mkdtempSync(join(tmpdir(), 'prisma-version-'));
  const source = fileURLToPath(new URL('../', import.meta.url));
  const worker = readFileSync(join(source, 'sw.js'), 'utf8');
  const assets = runInNewContext(worker.match(/const FILES = (\[[\s\S]*?\]);/)[1]);
  const files = [...new Set(['package.json', 'sw.js', 'android/app/build.gradle',
    'scripts/sync-version.mjs', 'scripts/version-code.mjs', 'scripts/cache-assets.mjs',
    ...assets.map(asset => asset === './' ? 'index.html' : asset.slice(2))])];
  try {
    for (const file of files) {
      mkdirSync(join(root, file, '..'), {recursive: true});
      cpSync(join(source, file), join(root, file));
    }
    const script = join(root, 'scripts/sync-version.mjs');
    execFileSync(process.execPath, [script]);
    execFileSync(process.execPath, [script, '--check']);
    const gradle = join(root, 'android/app/build.gradle');
    const expected = versionCodeFor(JSON.parse(readFileSync(join(root, 'package.json'))).version);
    assert.match(readFileSync(gradle, 'utf8'), new RegExp(`versionCode ${expected}`));
    writeFileSync(gradle, readFileSync(gradle, 'utf8').replace(`versionCode ${expected}`, 'versionCode 8'));
    assert.throws(() => execFileSync(process.execPath, [script, '--check'], {stdio: 'pipe'}),
      /Versão divergente/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
