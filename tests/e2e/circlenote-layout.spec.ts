import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('CircleNote 1280px full-page layout screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/mask-unmask/');
  await expect(page.getByRole('heading', { level: 1, name: 'Mask & Unmask' })).toBeVisible();
  await mkdir('test-results/circlenote-layout', { recursive: true });
  await page.screenshot({
    path: 'test-results/circlenote-layout/mask-unmask-1280.png',
    fullPage: true,
    animations: 'disabled',
  });
});
