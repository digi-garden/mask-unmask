#!/usr/bin/env node
/**
 * Build a standalone Pages artifact from the already validated composite
 * distribution without changing the existing production dist/ structure.
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

// Cloudflare Pages resolves extensionless URLs to matching .html files.
// An _redirects 200 rewrite to index.html instead redirects to the root app,
// losing the original safety-and-privacy pathname.
const appHtml = await readFile(resolve(target, 'mask-unmask/index.html'), 'utf8');
const privacyHtml = appHtml
  .replace(
    '<link rel="canonical" href="https://circle-note.com/mask-unmask/"',
    '<link rel="canonical" href="https://circle-note.com/mask-unmask/safety-and-privacy"',
  )
  .replace(
    '<meta property="og:url" content="https://circle-note.com/mask-unmask/"',
    '<meta property="og:url" content="https://circle-note.com/mask-unmask/safety-and-privacy"',
  );
await writeFile(resolve(target, 'mask-unmask/safety-and-privacy.html'), privacyHtml, 'utf8');

await writeFile(resolve(target, '_redirects'), '/mask-unmask /mask-unmask/ 301\n', 'utf8');
console.log('Standalone Pages artifact created in dist-standalone/');
