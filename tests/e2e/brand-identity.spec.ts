import { test, expect } from '@playwright/test';

for (const width of [375, 1280]) {
  test(`official digi-garden logo uses unmodified asset on a legible light surface at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/mask-unmask/');
    const provider = page.getByRole('link', { name: 'digi-garden（デジガーデン）のWebサイトを開く' });
    await expect(provider).toBeVisible();
    await expect(provider).toHaveAttribute('href', 'https://digi-garden.com/');
    await expect(provider).toHaveCSS('background-color', 'rgb(250, 250, 248)');
    const logo = provider.getByRole('img', { name: 'digi-garden（デジガーデン）' });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', '/mask-unmask/digi-garden-logo.svg');
    const dimensions = await logo.evaluate((img: HTMLImageElement) => ({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      renderedWidth: img.getBoundingClientRect().width,
    }));
    expect(dimensions.naturalWidth).toBeGreaterThan(0);
    expect(dimensions.naturalHeight).toBeGreaterThan(0);
    expect(dimensions.renderedWidth).toBeGreaterThanOrEqual(80);
  });
}
