import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('CircleNote 1280px full-page layout screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/mask-unmask/');
  await expect(page.getByRole('heading', { level: 1, name: 'Mask & Unmask' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await mkdir('test-results/circlenote-layout', { recursive: true });
  await page.screenshot({
    path: 'test-results/circlenote-layout/mask-unmask-1280.png',
    fullPage: true,
    animations: 'disabled',
  });
});

for (const width of [375, 1280]) {
  test(`CircleNote preserves focus and dialog layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/mask-unmask/');

    const input = page.locator('#mask-input');
    await input.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();
    await expect(input).toHaveCSS('border-top-color', 'rgb(121, 214, 202)');
    await expect(input).toHaveCSS('box-shadow', /0px 0px 0px 3px/);

    await input.fill(`john@example.com ${'長い入力テキスト'.repeat(100)}`);
    await expect(page.locator('#mask-output')).toHaveValue(/^\[CN_EMAIL_0001\]/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);

    await input.fill('[CN_EMAIL_0001]');
    const warning = page.getByText(/^警告: 入力テキスト内/);
    await expect(warning).toBeVisible();
    await expect(warning).toHaveCSS('color', 'rgb(245, 196, 119)');

    const reset = page.getByRole('button', { name: /共通クリア/ });
    await expect(reset).toHaveCSS('cursor', 'pointer');
    const background = await reset.evaluate((button) => getComputedStyle(button).backgroundColor);
    await reset.hover();
    await expect(reset).not.toHaveCSS('background-color', background);
    await reset.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x + box.width / 2).toBeCloseTo(width / 2, 0);
    expect(box.y + box.height / 2).toBeCloseTo(450, 0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
}
