#!/usr/bin/env node
/**
 * Read-only production HTTP smoke check. Does not upload text, log in, or write
 * to the target. Run manually after deploying (not in ordinary PR CI).
 */
import assert from 'node:assert/strict';

const origin = process.env.MU_PRODUCTION_ORIGIN ?? 'https://circle-note.com';
const timeoutMs = 10000;
const expectedOrigin = new URL(origin);
assert.equal(expectedOrigin.protocol, 'https:', 'Production origin must use HTTPS');
assert.equal(expectedOrigin.pathname, '/', 'Provide an origin, not an application path');
assert.equal(expectedOrigin.search, '', 'Query strings are not supported');
assert.equal(expectedOrigin.hash, '', 'Fragments are not supported');
const base = expectedOrigin.origin;

async function get(path, { redirect = 'follow' } = {}) {
  const url = new URL(path, base);
  const response = await fetch(url, {
    method: 'GET',
    redirect,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'text/html' },
  });
  return { response, url };
}

function checkStatus(response, url) {
  assert.ok(response.ok, `${url}: unexpected HTTP ${response.status}`);
}

const failures = [];
async function check(label, fn) {
  try {
    await fn();
    console.log(`PASS: ${label}`);
  } catch (error) {
    failures.push(label);
    console.error(`FAIL: ${label}: ${error.message}`);
  }
}

await check('application HTTPS and response security headers', async () => {
  const { response, url } = await get('/mask-unmask/');
  checkStatus(response, url);
  assert.equal(new URL(response.url).origin, base, 'Unexpected cross-origin redirect');
  const csp = response.headers.get('content-security-policy');
  assert.ok(csp, 'Content-Security-Policy is missing');
  assert.match(csp, /(?:^|;)\s*connect-src\s+'none'\s*(?:;|$)/);
  assert.match(csp, /(?:^|;)\s*object-src\s+'none'\s*(?:;|$)/);
  assert.match(csp, /(?:^|;)\s*frame-ancestors\s+'none'\s*(?:;|$)/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  const contentType = response.headers.get('content-type') ?? '';
  assert.match(contentType, /text\/html/i, 'Expected HTML content type');
  const html = await response.text();
  assert.match(html, /Mask &(?:amp;)? Unmask/, 'Product title not found');
});

await check('canonical /mask-unmask redirect', async () => {
  const { response } = await get('/mask-unmask', { redirect: 'manual' });
  assert.equal(response.status, 301, 'Expected permanent redirect');
  const location = response.headers.get('location');
  assert.ok(location, 'Missing Location header');
  assert.equal(new URL(location, base).href, `${base}/mask-unmask/`);
});

await check('safety-and-privacy direct entry', async () => {
  const { response, url } = await get('/mask-unmask/safety-and-privacy');
  checkStatus(response, url);
  assert.equal(new URL(response.url).origin, base, 'Unexpected cross-origin redirect');
  assert.match(response.headers.get('content-type') ?? '', /text\/html/i);
});

for (const [label, path] of [
  ['terms', '/terms/'],
  ['privacy policy', '/privacy/'],
]) {
  await check(`legal: ${label}`, async () => {
    const url = new URL(path, 'https://digi-garden.com');
    const response = await fetch(url, {
      method: 'GET', redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'text/html' },
    });
    checkStatus(response, url);
    assert.equal(new URL(response.url).protocol, 'https:');
    assert.match(response.headers.get('content-type') ?? '', /text\/html/i);
  });
}

if (failures.length) {
  console.error(`Production smoke checks failed: ${failures.length}`);
  process.exitCode = 1;
} else {
  console.log('All production HTTP smoke checks passed.');
}
