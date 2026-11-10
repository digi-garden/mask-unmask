import { test, expect } from '@playwright/test';

test('OSS notices are linked from the app and served beneath its deployment path', async ({ page, request }) => {
  await page.goto('/mask-unmask/');
  const link = page.getByRole('link', { name: 'OSSライセンス' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '/mask-unmask/third-party-licenses/README.md');

  const manifestResponse = await request.get('/mask-unmask/third-party-licenses/README.md');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.text();

  for (const pkg of ['react', 'react-dom', 'scheduler', 'js-tokens', 'loose-envify']) {
    const section = manifest.split('\n').find((line) => line.startsWith(`## ${pkg}@`));
    expect(section, `Missing manifest entry for ${pkg}`).toBeDefined();
  }

  const listedFiles = [...manifest.matchAll(/^- (.+)$/gm)].map((match) => match[1]);
  expect(listedFiles.length).toBeGreaterThanOrEqual(5);
  for (const file of listedFiles) {
    expect(file).toMatch(/^[a-zA-Z0-9._@-]+-LICEN[CS]E(?:[._-][a-zA-Z0-9._-]+)?$|^[a-zA-Z0-9._@-]+-(?:COPYING|NOTICE)(?:[._-][a-zA-Z0-9._-]+)?$/i);
    const response = await request.get(`/mask-unmask/third-party-licenses/${file}`);
    expect(response.ok(), file).toBeTruthy();
    expect((await response.text()).length, file).toBeGreaterThan(20);
  }
});
