import { expect, test } from '@playwright/test';

/**
 * MU-COMP-003: exercise the production build through the local preview server.
 * Network capture starts AFTER the initial HTML/CSS/JS has loaded so that
 * static asset requests do not mask unexpected transfers of user input.
 *
 * This is a regression test, NOT evidence that the deployed production origin
 * has passed the equivalent browser/network inspection.
 */
test('mask, unmask and reset issue no additional HTTP(S) requests', async ({ page }) => {
  await page.goto('/mask-unmask/');
  await page.waitForLoadState('networkidle');

  const unexpectedRequests: string[] = [];
  page.on('request', (request) => {
    if (/^https?:\/\//i.test(request.url())) {
      unexpectedRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  const sample = 'Please contact test@example.com about this issue.';
  await page.locator('#mask-input').fill(sample);
  await expect(page.locator('#mask-output')).toContainText('CN_EMAIL_');

  await page.locator('#tab-unmask').click();
  await page.locator('#unmask-input').fill('Example [CN_EMAIL_0001]');
  await page.locator('#tab-mask').click();

  await page.getByRole('button', { name: '共通クリア (リセット)' }).click();
  await page.getByRole('button', { name: 'クリア実行' }).click();
  await expect(page.locator('#mask-input')).toHaveValue('');

  // Ensure debounced state updates and asynchronous UI effects have completed.
  await page.waitForTimeout(700);
  expect(unexpectedRequests, 'User-data operations must not initiate HTTP(S) traffic').toEqual([]);
});
