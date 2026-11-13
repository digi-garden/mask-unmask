import { defineConfig, devices } from '@playwright/test';

/** Production VRAM release check: fixed allowlisted host, synthetic test values only. */
export default defineConfig({
  testDir: './tests/production-vram',
  fullyParallel: false,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'https://circle-note.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
