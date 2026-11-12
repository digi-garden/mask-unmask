#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('dist-standalone');
const entries = await readdir(root);
assert.deepEqual(entries.sort(), ['_headers', '_redirects', 'mask-unmask']);
const app = resolve(root, 'mask-unmask');
assert.equal((await stat(resolve(app, 'index.html'))).isFile(), true);
const html = await readFile(resolve(app, 'index.html'), 'utf8');
assert.match(html, /Mask &amp; Unmask/);
assert.match(html, /https:\/\/circle-note\.com\/mask-unmask\//);
assert.match(html, /\/mask-unmask\/assets\//);
assert.doesNotMatch(html, /CircleNote \| ブラウザで使えるテキスト仮名化ツール/);
const redirects = await readFile(resolve(root, '_redirects'), 'utf8');
assert.match(redirects, /^\/mask-unmask \/mask-unmask\/ 301/m);
assert.match(redirects, /^\/mask-unmask\/safety-and-privacy \/mask-unmask\/index\.html 200/m);
assert.doesNotMatch(redirects, /\/mask-unmask\/assets\/\*/);
const headers = await readFile(resolve(root, '_headers'), 'utf8');
assert.match(headers, /connect-src 'none'/);
assert.match(headers, /frame-ancestors 'none'/);
assert.equal(entries.includes('index.html'), false);
assert.equal(entries.includes('circle-note.css'), false);
assert.equal(entries.includes('robots.txt'), false);
assert.equal(entries.includes('sitemap.xml'), false);
assert.equal((await stat(resolve(app, 'third-party-licenses/README.md'))).isFile(), true);
console.log('PASS standalone artifact: app only, no portal, headers, routes, licenses');
