#!/usr/bin/env node
/**
 * MU-COMP-005: compare the actually hosted OSS notices against the locally
 * built release candidate. This is an opt-in POST-DEPLOY check, not a CI test.
 *
 * Usage: npm ci && npm run build && npm run verify:production:oss
 *        OSS_VERIFY_ORIGIN=https://preview.example.pages.dev npm run verify:production:oss
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const origin = process.env.OSS_VERIFY_ORIGIN ?? 'https://circle-note.com';
const baseUrl = new URL(origin);
if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password ||
  baseUrl.search || baseUrl.hash || baseUrl.pathname !== '/') {
  throw new Error('OSS_VERIFY_ORIGIN must be a HTTPS origin ending in / (no path, credentials, query or fragment)');
}
const appPath = '/mask-unmask/';
const dist = resolve('dist', 'mask-unmask');
const noticeDir = join(dist, 'third-party-licenses');
const names = (await readdir(noticeDir)).sort();
const noticeNames = names.filter((x) => x !== 'README.md');
if (noticeNames.length < 6 || !names.includes('README.md') || !names.includes('Manrope-OFL.txt')) {
  throw new Error('Expected runtime MIT notices and Manrope OFL in local release candidate');
}
const targets = ['index.html', 'bundle-provenance.json',
  ...names.map((name) => 'third-party-licenses/' + name)];
const checksum = (value) => createHash('sha256').update(value).digest('hex');
const errors = [];
for (const target of targets) {
  const local = await readFile(join(dist, target));
  const remoteUrl = new URL(appPath + (target === 'index.html' ? '' : target), baseUrl);
  let response;
  try {
    response = await fetch(remoteUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: target.endsWith('.json') ? 'application/json' : '*/*' },
    });
  } catch (error) {
    errors.push(`${remoteUrl.href}: request error: ${error.message}`);
    continue;
  }
  if (!response.ok) {
    errors.push(`${remoteUrl.href}: HTTP ${response.status}`);
    continue;
  }
  const body = Buffer.from(await response.arrayBuffer());
  const mime = response.headers.get('content-type') ?? '';
  if (target !== 'index.html' && /text\/html/i.test(mime)) {
    errors.push(`${remoteUrl.href}: returned HTML rather than requested OSS asset`);
    continue;
  }
  if (checksum(local) !== checksum(body)) {
    errors.push(`${remoteUrl.href}: deployment bytes differ from local release candidate`);
    continue;
  }
  if (target === 'bundle-provenance.json') {
    try {
      const parsed = JSON.parse(body.toString('utf8'));
      if (!Array.isArray(parsed.packages) || parsed.packages.length === 0) {
        errors.push(`${remoteUrl.href}: empty bundle provenance`);
      }
    } catch {
      errors.push(`${remoteUrl.href}: invalid bundle provenance JSON`);
    }
  }
  console.log(`PASS: ${remoteUrl.pathname} SHA256 ${checksum(local)}`);
}
const localHtml = (await readFile(join(dist, 'index.html'), 'utf8'));
if (!localHtml.includes('assets/')) {
  // Vite app HTML must refer to bundled assets. Fail rather than accidentally
  // validating a placeholder page from the wrong deployment.
  errors.push('Local Mask & Unmask HTML has no assets reference');
}
if (errors.length) {
  for (const message of errors) console.error(`FAIL: ${message}`);
  process.exitCode = 1;
} else {
  console.log(`PASS: all ${targets.length} production OSS/HTML assets equal the inspected local release candidate at ${baseUrl.origin}`);
  console.log('NOTE: this validates distributed bytes, not legal interpretation or live deployment identity alone.');
}
