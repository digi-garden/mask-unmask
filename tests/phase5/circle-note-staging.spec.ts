import { expect, test, type Page } from '@playwright/test';

async function attachBrowserDiagnostics(page: Page) {
  const errors: string[] = [];
  const violations: string[] = [];
  const foreignRequests: string[] = [];
  const approvedOrigin = new URL(process.env.CIRCLE_NOTE_STAGING_URL ??
    'https://circle-note-router-staging.masato-okada.workers.dev').origin;
  page.on('request', (request) => {
    if (/^https?:\/\//i.test(request.url()) &&
        new URL(request.url()).origin !== approvedOrigin) {
      foreignRequests.push(`${request.method()} ${new URL(request.url()).origin}`);
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) => errors.push(`Request failed: ${new URL(request.url()).pathname}`));
  await page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { __cspFailures?: string[] }).__cspFailures ??= [];
      (window as unknown as { __cspFailures: string[] }).__cspFailures.push(event.violatedDirective);
    });
  });
  return {
    async assertClean() {
      violations.push(...await page.evaluate(() =>
        (window as unknown as { __cspFailures?: string[] }).__cspFailures ?? []));
      expect(errors, 'Browser JS/console/network failures').toEqual([]);
      expect(foreignRequests, 'Unexpected cross-origin browser requests').toEqual([]);
      expect(violations, 'Browser CSP violations').toEqual([]);
    },
  };
}

test('P5-01: portal links to the published Mask app, not planned apps', async ({ page }) => {
  const diag = await attachBrowserDiagnostics(page);
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'CircleNote', exact: true })).toBeVisible();
  const maskLink = page.getByRole('link', { name: /Mask & Unmaskを開く/ });
  await expect(maskLink).toHaveAttribute('href', '/mask-unmask/');
  await expect(page.getByText('Context-Packer')).toBeVisible();
  await expect(page.getByText('VRAM Calculator')).toBeVisible();
  await maskLink.click();
  await expect(page).toHaveURL(/\/mask-unmask\/$/);
  await expect(page.locator('#mask-input')).toBeVisible();
  await diag.assertClean();
});

test('P5-02: Mask/Unmask, map export, and no extra HTTP traffic after load', async ({ page }) => {
  const diag = await attachBrowserDiagnostics(page);
  const response = await page.goto('/mask-unmask/');
  expect(response?.status()).toBe(200);
  await page.waitForLoadState('networkidle');
  const htmlHeaders = response?.headers() ?? {};
  expect(htmlHeaders['content-security-policy']).toContain("connect-src 'none'");
  const traffic: string[] = [];
  page.on('request', (request) => {
    if (/^https?:\/\//i.test(request.url())) traffic.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await page.locator('#mask-input').fill('架空の連絡先 example@example.com と 192.0.2.5');
  await expect(page.locator('#mask-output')).toHaveValue(/\[CN_EMAIL_0001\].*\[CN_IPV4_0001\]/);
  await page.locator('#tab-unmask').click();
  await page.locator('#unmask-input').fill('確認 [CN_EMAIL_0001]');
  await expect(page.locator('#unmask-output')).toHaveValue('確認 example@example.com');
  await page.getByRole('button', { name: 'マップエクスポート' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '同意してエクスポート' }).click();
  expect((await download).suggestedFilename()).toMatch(/^mask-unmask-map-.*\.json$/);
  const importPayload = JSON.stringify({
    version: '1.0',
    createdAt: '2026-11-02T00:00:00Z',
    mappings: [{
      tag: '[CN_EMAIL_0002]',
      original: 'imported-test@example.org',
      category: 'EMAIL',
    }],
  });
  await page.locator('input[aria-label="マッピングファイルをインポート"]').setInputFiles({
    name: 'phase5-test-map.json',
    mimeType: 'application/json',
    buffer: Buffer.from(importPayload, 'utf8'),
  });
  await expect(page.getByRole('button', { name: 'インポート確定' })).toBeVisible();
  await page.getByRole('button', { name: 'インポート確定' }).click();
  await page.waitForTimeout(700);
  expect(traffic, 'No HTTP(S) requests after app load during user-data operations').toEqual([]);
  await diag.assertClean();
});

test('P5-03: privacy deep link survives reload and return navigation', async ({ page }) => {
  const diag = await attachBrowserDiagnostics(page);
  const response = await page.goto('/mask-unmask/safety-and-privacy');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('安全性とプライバシーについて', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/mask-unmask\/safety-and-privacy$/);
  await expect(page.getByText('安全性とプライバシーについて', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ツールに戻る' }).click();
  await expect(page).toHaveURL(/\/mask-unmask\/$/);
  await expect(page.locator('#mask-input')).toBeVisible();
  await diag.assertClean();
});

test('P5-04: VRAM calculator responds to changed inputs', async ({ page }) => {
  const diag = await attachBrowserDiagnostics(page);
  const response = await page.goto('/vram-calculator/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'VRAM計算機' })).toBeVisible();
  await expect(page.locator('[data-testid="breakdown"]')).toBeVisible();
  // 'reserved' reduces available GPU capacity, not the model's required VRAM.
  // The breakdown stays unchanged; the available capacity and verdict may change.
  const initialBreakdown = await page.locator('[data-testid="breakdown"]').innerText();
  const initialSummary = await page.locator('section[aria-labelledby="result-heading"]').innerText();
  await page.locator('#reserved').fill('5');
  await expect(page.locator('#reserved')).toHaveValue('5');
  await expect.poll(async () =>
    page.locator('section[aria-labelledby="result-heading"]').innerText(),
  ).not.toBe(initialSummary);
  await expect(page.locator('section[aria-labelledby="result-heading"]')).toContainText('使える容量 7.0 GB');
  await expect(page.locator('[data-testid="breakdown"]')).toHaveText(initialBreakdown);
  await page.getByRole('button', { name: '入力をリセット' }).click();
  await expect(page.locator('#reserved')).not.toHaveValue('5');
  await expect.poll(async () =>
    page.locator('section[aria-labelledby="result-heading"]').innerText(),
  ).toBe(initialSummary);
  await diag.assertClean();
});

test('P5-05: Context-Packer is unavailable with no-store response', async ({ request }) => {
  const result = await request.get('/context-packer/', { maxRedirects: 0 });
  expect(result.status()).toBe(503);
  expect(result.headers()['cache-control']).toContain('no-store');
});
