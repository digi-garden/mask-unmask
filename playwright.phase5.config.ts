import { defineConfig, devices } from '@playwright/test';

const DEFAULT_URL = 'https://circle-note-router-staging.masato-okada.workers.dev';
const provided = process.env.CIRCLE_NOTE_STAGING_URL ?? DEFAULT_URL;
const target = new URL(provided);
if (
  target.protocol !== 'https:' ||
  !target.hostname.endsWith('.workers.dev') ||
  !target.hostname.startsWith('circle-note-router-staging.') ||
  target.pathname !== '/' ||
  target.search || target.hash || target.username || target.password
) {
  throw new Error('Phase 5 browser tests require the approved workers.dev STAGING origin, not production');
}

export default defineConfig({
  testDir: './tests/phase5',
  fullyParallel: false,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: target.origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
