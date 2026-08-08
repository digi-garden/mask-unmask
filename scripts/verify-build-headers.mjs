import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const headers = await readFile(resolve(repositoryRoot, 'dist/_headers'), 'utf8');

const requiredHeaders = [
  "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'",
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: no-referrer',
  'Cache-Control: public, max-age=0, must-revalidate, no-transform',
];

for (const requiredHeader of requiredHeaders) {
  if (!headers.split(/\r?\n/).some((line) => line.trim() === requiredHeader)) {
    throw new Error(`dist/_headers is missing required header: ${requiredHeader}`);
  }
}
