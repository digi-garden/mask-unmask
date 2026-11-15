import { test, expect } from '@playwright/test';

for (const width of [375, 1280]) {
  test(`CircleNote attribution uses a text link without the color logo at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/mask-unmask/');

    const footer = page.getByRole('contentinfo');
    const provider = footer.getByRole('link', { name: 'digi-garden', exact: true });
    await expect(provider).toBeVisible();
    await expect(provider).toHaveAttribute('href', 'https://digi-garden.com/');
    await expect(footer).toContainText('by digi-garden');
    await expect(footer.locator('img')).toHaveCount(0);

    await expect(page.getByRole('banner').getByRole('link', { name: 'CircleNote' }))
      .toHaveAttribute('href', '/');
  });
}
