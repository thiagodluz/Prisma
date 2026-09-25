import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cachedFiles} from '../scripts/cache-assets.mjs';

test('an asset edit requires a new cache, and publishing it requires a newer version', () => {
  const root = mkdtempSync(join(tmpdir(), 'prisma-cache-'));
  const source = fileURLToPath(new URL('../', import.meta.url));
  const worker = readFileSync(join(source, 'sw.js'), 'utf8');
  const files = ['package.json', 'sw.js', 'android/app/build.gradle',
    'scripts/sync-version.mjs', 'scripts/version-code.mjs', 'scripts/cache-assets.mjs',
    'scripts/check-publish-version.mjs', ...cachedFiles(worker)];
  const run = (...args) => execFileSync(process.execPath, args, {cwd: root, encoding: 'utf8', stdio: 'pipe'});
  const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: 'pipe'});
  try {
    for (const file of new Set(files)) {
      mkdirSync(join(root, file, '..'), {recursive: true});
      cpSync(join(source, file), join(root, file));
    }
    const sync = join(root, 'scripts/sync-version.mjs');
    const policy = join(root, 'scripts/check-publish-version.mjs');
    const engine = join(root, 'engine.js');
    const sw = join(root, 'sw.js');
    const packageFile = join(root, 'package.json');
    writeFileSync(packageFile, readFileSync(packageFile, 'utf8').replace('1.0.4-beta.1', '1.0.3'));
    run(sync);
    git('init', '-q');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.invalid');
    git('add', '.');
    git('commit', '-qm', 'release');
    git('tag', 'v1.0.3');
    const firstCache = readFileSync(sw, 'utf8').match(/const CACHE = '([^']+)'/)[1];
    writeFileSync(engine, readFileSync(engine, 'utf8') + '\n// cache refresh test\n');
    assert.throws(() => run(sync, '--check'), /Cache desatualizado/);
    run(sync);
    const nextCache = readFileSync(sw, 'utf8').match(/const CACHE = '([^']+)'/)[1];
    assert.notEqual(nextCache, firstCache);
    run(sync, '--check');
    git('add', '.');
    git('commit', '-qm', 'code without version bump');
    assert.throws(() => run(policy), /sem aumentar a versão/);
    writeFileSync(packageFile, readFileSync(packageFile, 'utf8').replace('1.0.3', '1.0.4-beta.1'));
    run(sync);
    git('add', '.');
    git('commit', '-qm', 'new version');
    assert.doesNotThrow(() => run(policy));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
