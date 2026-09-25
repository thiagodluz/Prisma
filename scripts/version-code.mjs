export function versionCodeFor(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.([1-9]\d*))?$/.exec(version);
  if (!match) throw new Error(`Versão Android inválida: ${version}`);
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  const beta = match[4] === undefined ? undefined : Number(match[4]);
  if (![major, minor, patch].every(Number.isSafeInteger) || minor >= 100 || patch >= 100 ||
      beta !== undefined && (!Number.isSafeInteger(beta) || beta > 98))
    throw new Error(`Versão Android fora dos limites: ${version}`);
  const code = major * 1_000_000 + minor * 10_000 + patch * 100 + (beta ?? 99);
  if (!Number.isSafeInteger(code) || code < 1 || code > 2_100_000_000)
    throw new Error(`versionCode fora do limite Android: ${code}`);
  return code;
}
