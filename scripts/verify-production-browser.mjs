#!/usr/bin/env node
/**
 * Opt-in browser inspection of the real publicly deployed application.
 * Uses only fixed, synthetic text. Read-only to the remote server: do not
 * send real user data or change live hosting. No screenshots, traces or
 * browser storage are exported.
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const target = process.env.MU_PRODUCTION_BROWSER_URL ?? 'https://circle-note.com/mask-unmask/';
const url = new URL(target);
assert.equal(url.protocol, 'https:', 'Production browser URL must use HTTPS');
assert.equal(url.search, '', 'Do not use query strings');
assert.equal(url.hash, '', 'Do not use URL fragments');
assert.equal(url.pathname, '/mask-unmask/', 'Expected canonical application path');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();
const unexpected = [];
const failed = [];
const cspViolations = [];

try {
  await page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (event) => {
      const entry = { directive: event.violatedDirective, disposition: event.disposition };
      const w = window;
      w.__muCspViolations = [...(w.__muCspViolations ?? []), entry];
    });
  });

  const response = await page.goto(url.href, { waitUntil: 'networkidle', timeout: 30000 });
  assert.ok(response?.ok(), `Application returned HTTP ${response?.status() ?? 'unknown'}`);
  await page.getByRole('heading', { name: 'Mask & Unmask' }).first().waitFor();
  const csp = response.headers()['content-security-policy'] ?? '';
  assert.match(csp, /(?:^|;)\s*connect-src\s+'none'\s*(?:;|$)/);

  // All requests below this point are unexpected during local-only user operations.
  page.on('request', (request) => {
    if (/^https?:\/\//i.test(request.url())) {
      const req = new URL(request.url());
      unexpected.push(`${request.method()} ${req.origin}${req.pathname}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (/^https?:\/\//i.test(request.url())) {
      const req = new URL(request.url());
      failed.push(`${request.method()} ${req.origin}${req.pathname}`);
    }
  });

  await page.locator('#mask-input').fill('Synthetic contact test@example.com (TEST DATA ONLY)');
  await page.locator('#mask-output').waitFor();
  await page.waitForTimeout(850);
  assert.match(await page.locator('#mask-output').inputValue(), /CN_EMAIL_/);

  await page.locator('#tab-unmask').click();
  await page.locator('#unmask-input').fill('Synthetic [CN_EMAIL_0001] (TEST DATA ONLY)');
  await page.waitForTimeout(850);
  await page.locator('#tab-mask').click();
  await page.getByRole('button', { name: '共通クリア (リセット)' }).click();
  await page.getByRole('button', { name: 'クリア実行' }).click();
  await page.waitForTimeout(850);
  assert.equal(await page.locator('#mask-input').inputValue(), '', 'Mask input was not cleared');

  cspViolations.push(...await page.evaluate(() => window.__muCspViolations ?? []));
  // No secret or synthetic input text is written to the output log.
  assert.deepEqual(unexpected, [], 'Unexpected network activity during data operations');
  assert.deepEqual(failed, [], 'Failed network activity during data operations');
  assert.deepEqual(cspViolations, [], 'CSP violation during browser inspection');
  console.log(`PASS: production browser checks at ${url.origin}${url.pathname}`);
  console.log('PASS: synthetic Mask/Unmask/reset operations completed without HTTP(S) requests or CSP violations');
  console.log('NOTE: check corresponds to currently deployed code, not unmerged PR content.');
} catch (error) {
  console.error(`FAIL: production browser inspection: ${error.message}`);
  if (unexpected.length) console.error(`Observed network requests: ${JSON.stringify(unexpected)}`);
  if (failed.length) console.error(`Failed requests: ${JSON.stringify(failed)}`);
  if (cspViolations.length) console.error(`CSP violations: ${JSON.stringify(cspViolations)}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
