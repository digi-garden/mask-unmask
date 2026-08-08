import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(repositoryRoot, 'dist');
const redirects = await readFile(resolve(outputRoot, '_redirects'), 'utf8');

const rules = redirects
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const canonicalRedirect = '/mask-unmask /mask-unmask/ 301';
if (rules.length !== 1 || rules[0] !== canonicalRedirect) {
  throw new Error(`dist/_redirects must contain only: ${canonicalRedirect}`);
}

if (redirects.includes('/mask-unmask/assets/*') || redirects.includes('/mask-unmask/index.html')) {
  throw new Error('dist/_redirects must not contain self-proxy or SPA fallback rules');
}
