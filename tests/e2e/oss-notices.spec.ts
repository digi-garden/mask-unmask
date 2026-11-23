import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('OSS notices are linked from the app and served beneath its deployment path', async ({ page, request }) => {
  await page.goto('/mask-unmask/');
  const link = page.getByRole('link', { name: 'OSSライセンス' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '/mask-unmask/third-party-licenses/README.md');

  // Vite preview does not apply Cloudflare Pages _headers; assert published rules explicitly.
  const headers = await readFile('public/_headers', 'utf8');
  expect(headers).toContain('/mask-unmask/third-party-licenses/*');
  expect(headers).toContain('Content-Type: text/plain; charset=utf-8');
  expect(headers).toContain('Content-Disposition: inline');

  const manifestResponse = await request.get('/mask-unmask/third-party-licenses/README.md');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.text();

  const lock = JSON.parse(await readFile('package-lock.json', 'utf8')) as {
    packages: Record<string, { version?: string; dev?: boolean; license?: string }>;
  };
  const packagePrefix = 'node_modules/';
  const runtimePackages = Object.entries(lock.packages)
    .filter(([path, metadata]) => path.startsWith(packagePrefix) && metadata.dev !== true);
  expect(runtimePackages.length).toBeGreaterThan(0);

  const runtimeSections = manifest.split(/^## /m).slice(1)
    .filter((section) => /^\S+@/.test(section));
  const expectedHeadings = runtimePackages.map(([path, { version, license }]) => {
    const name = path.slice(packagePrefix.length);
    expect(version, `Missing lockfile version for ${name}`).toBeTruthy();
    const heading = `${name}@${version} (lockfile: ${license ?? 'UNKNOWN'})`;
    const section = runtimeSections.find((entry) => entry.startsWith(`${heading}\n`));
    const noticePrefix = `- ${name.replaceAll('/', '__')}-${version}-`;
    expect(section?.split('\n').some((line) => line.startsWith(noticePrefix)),
      `Missing original notice listing for ${name}@${version}`).toBe(true);
    return heading;
  });
  expect(runtimeSections.map((section) => section.split('\n', 1)[0]).sort())
    .toEqual(expectedHeadings.sort());

  const tailwindVersion = lock.packages['node_modules/tailwindcss']?.version;
  expect(tailwindVersion, 'Missing tailwindcss lockfile version').toBeTruthy();
  expect(manifest).toContain('## Build-time CSS-origin code (included in generated CSS)');
  expect(manifest.split('\n')).toContain(`### tailwindcss@${tailwindVersion} (lockfile: MIT; build-time CSS)`);
  expect(manifest.split('\n')).toContain(`- tailwindcss-${tailwindVersion}-LICENSE`);

  expect(manifest).toContain('Embedded Manrope font');
  expect(manifest).toContain('Notice file: Manrope-OFL.txt');
  const fontResponse = await request.get('/mask-unmask/third-party-licenses/Manrope-OFL.txt');
  expect(fontResponse.ok()).toBeTruthy();
  expect(await fontResponse.text()).toContain('SIL OPEN FONT LICENSE Version 1.1');
  const provenanceResponse = await request.get('/mask-unmask/bundle-provenance.json');
  expect(provenanceResponse.ok()).toBeTruthy();
  const provenance = await provenanceResponse.json() as {
    packages: Array<{ name: string; version: string; license: string; development: boolean; moduleCount: number }>;
  };
  expect(provenance.packages.length).toBeGreaterThanOrEqual(3);
  for (const item of provenance.packages) {
    expect(item.license).toBe('MIT');
    expect(item.development).toBe(false);
    const metadata = lock.packages[`${packagePrefix}${item.name}`];
    expect(metadata, `Missing lockfile entry for bundled package ${item.name}`).toBeDefined();
    expect(metadata.version).toBe(item.version);
    expect(metadata.license).toBe(item.license);
    expect(metadata.dev).not.toBe(true);
    expect(Number.isSafeInteger(item.moduleCount)).toBe(true);
    expect(item.moduleCount).toBeGreaterThan(0);
  }

  const listedFiles = [...manifest.matchAll(/^- (.+)$/gm)].map((match) => match[1]);
  for (const file of listedFiles) {
    expect(file).toMatch(/^[a-zA-Z0-9._@-]+-LICEN[CS]E(?:[._-][a-zA-Z0-9._-]+)?$|^[a-zA-Z0-9._@-]+-(?:COPYING|NOTICE)(?:[._-][a-zA-Z0-9._-]+)?$/i);
    const response = await request.get(`/mask-unmask/third-party-licenses/${file}`);
    expect(response.ok(), file).toBeTruthy();
    expect((await response.text()).length, file).toBeGreaterThan(20);
  }
});
