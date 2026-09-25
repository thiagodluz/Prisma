import {runInNewContext} from 'node:vm';

export function cachedFiles(worker) {
  const manifest = worker.match(/const FILES = (\[[\s\S]*?\]);/);
  if (!manifest) throw new Error('Lista de arquivos do Service Worker ausente');
  const assets = runInNewContext(manifest[1]);
  if (!Array.isArray(assets) || assets.length === 0) throw new Error('Lista de arquivos inválida');
  const files = assets.map(asset => {
    if (typeof asset !== 'string' || !/^\.\/[\w./-]*$/.test(asset) || asset.includes('..'))
      throw new Error(`Caminho de cache inválido: ${asset}`);
    const file = asset === './' ? 'index.html' : asset.slice(2);
    if (file === 'sw.js') throw new Error('O Service Worker não pode entrar no próprio hash');
    return file;
  });
  return [...new Set(files)];
}
