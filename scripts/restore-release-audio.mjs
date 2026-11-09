import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
const source = readFileSync('scripts/download-audio.mjs', 'utf8');
const assets = new Map([...source.matchAll(/'(audio\/[^']+)': '([a-f0-9]{64})'/g)].map(([,path,hash]) => [hash,path]));
const html = readFileSync(process.argv[2], 'utf8');
for (const [,data] of html.matchAll(/data:audio\/(?:ogg|mpeg);base64,([A-Za-z0-9+/=]+)/g)) {
 const bytes = Buffer.from(data, 'base64');
 const hash = createHash('sha256').update(bytes).digest('hex');
 const path = assets.get(hash);
 if (path) { mkdirSync(dirname(path), {recursive:true}); writeFileSync(path,bytes); assets.delete(hash); }
}
if (assets.size) throw new Error(`Áudios ausentes ou divergentes: ${[...assets.values()].join(', ')}`);
console.log('Nove áudios originais recuperados e verificados.');
