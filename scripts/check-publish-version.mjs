import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {cachedFiles} from './cache-assets.mjs';
import {versionCodeFor} from './version-code.mjs';

const git = (...args) => execFileSync('git', args, {encoding: 'utf8'}).trim();
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;
const currentCode = versionCodeFor(version);
const runningTag = process.env.GITHUB_REF?.startsWith('refs/tags/') ? process.env.GITHUB_REF.slice(10) : null;
const tags = git('tag', '--merged', 'HEAD', '--list', 'v*').split('\n').filter(Boolean)
  .filter(tag => tag !== runningTag)
  .map(tag => {
    try { return {tag, code: versionCodeFor(tag.slice(1))}; }
    catch { return null; }
  }).filter(Boolean).sort((a, b) => b.code - a.code);
if (tags.length) {
  const {tag, code} = tags[0];
  if (currentCode < code) throw new Error(`Versão ${version} anterior à última tag ${tag}`);
  const paths = [...new Set([
    ...cachedFiles(readFileSync(new URL('../sw.js', import.meta.url), 'utf8')),
    ...cachedFiles(git('show', `${tag}:sw.js`)),
    'sw.js', 'android/app/src', 'android/app/build.gradle'
  ])];
  const changed = git('diff', '--name-only', '--no-renames', tag, 'HEAD', '--', ...paths);
  if (changed && currentCode <= code)
    throw new Error(`Arquivos do jogo alterados desde ${tag} sem aumentar a versão: ${changed}`);
}
