#!/usr/bin/env node
/**
 * Prepare a standalone Pages artifact from the existing, compliance-verified
 * composite build. Does not change the current production dist/ structure.
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const source = resolve(root, 'dist');
const target = resolve(root, 'dist-standalone');

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(resolve(source, 'mask-unmask'), resolve(target, 'mask-unmask'), { recursive: true });
const headers = await readFile(resolve(source, '_headers'), 'utf8');
await writeFile(resolve(target, '_headers'), headers, 'utf8');

// Pages serves the app at its existing /mask-unmask/ path. No portal at /.
// Pages rewrites to index.html can redirect to /mask-unmask/ (308), losing\n// the requested SPA path. Pages serves a matching .html file at its\n// extensionless URL without such a redirect.\nconst appHtml = await readFile(resolve(target, 'mask-unmask/index.html'), 'utf8');\nconst privacyHtml = appHtml\n  .replace('https://circle-note.com/mask-unmask/', 'https://circle-note.com/mask-unmask/safety-and-privacy')\n  .replace('content="https://circle-note.com/mask-unmask/"', 'content="https://circle-note.com/mask-unmask/safety-and-privacy"');\nawait writeFile(resolve(target, 'mask-unmask/safety-and-privacy.html'), privacyHtml, 'utf8');
await writeFile(resolve(target, '_redirects'),
  '/mask-unmask /mask-unmask/ 301\n',
  'utf8',
);
console.log('Standalone Pages artifact created in dist-standalone/');
