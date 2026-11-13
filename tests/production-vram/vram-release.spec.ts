import { expect, test } from '@playwright/test';

test('P6-VRAM-01: production VRAM calculator calculates and resets without unexpected traffic', async ({ page }) => {
  const errors: string[] = [];
  const foreignRequests: string[] = [];
  const violations: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) =>
    errors.push(`Failed request: ${request.url()}`));
  page.on('request', (request) => {
    if (/^https?:\/\//.test(request.url()) &&
        new URL(request.url()).origin !== 'https://circle-note.com') {
      foreignRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  await page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { __violations?: string[] }).__violations ??= [];
      (window as unknown as { __violations: string[] }).__violations.push(event.violatedDirective);
    });
  });

  const response = await page.goto('/vram-calculator/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'VRAM計算機' })).toBeVisible();
  const results = page.locator('section[aria-labelledby="result-heading"]');
  const breakdown = page.locator('[data-testid="breakdown"]');
  await expect(breakdown).toBeVisible();
  await page.waitForLoadState('networkidle');
  const initial = await results.innerText();
  const initialBreakdown = await breakdown.innerText();

  const requestsAfterLoad: string[] = [];
  page.on('request', (request) => {
    if (/^https?:\/\//.test(request.url())) {
      requestsAfterLoad.push(`${request.method()} ${request.url()}`);
    }
  });
  await page.locator('#reserved').fill('5');
  await expect(page.locator('#reserved')).toHaveValue('5');
  await expect(results).toContainText('使える容量 7.0 GB');
  await expect.poll(() => results.innerText()).not.toBe(initial);
  await expect.poll(() => breakdown.innerText()).toBe(initialBreakdown);

  await page.locator('#reserved').fill('invalid');
  await expect(page.locator('#reserved')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-testid="verdict"]')).toHaveCount(0);

  await page.getByRole('button', { name: '入力をリセット' }).click();
  await expect(page.locator('#reserved')).not.toHaveValue('invalid');
  await expect.poll(() => results.innerText()).toBe(initial);
  await page.waitForTimeout(300);

  violations.push(...await page.evaluate(() =>
    (window as unknown as { __violations?: string[] }).__violations ?? []));
  expect(requestsAfterLoad, 'Calculator input must not start network requests').toEqual([]);
  expect(foreignRequests, 'Initial page load must not request off-origin assets').toEqual([]);
  expect(violations, 'No CSP violations').toEqual([]);
  expect(errors, 'No JS, console or failed network errors').toEqual([]);
});
