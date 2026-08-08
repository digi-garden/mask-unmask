import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(repositoryRoot, 'dist');
const redirects = await readFile(resolve(outputRoot, '_redirects'), 'utf8');
const appIndex = await readFile(resolve(outputRoot, 'mask-unmask/index.html'), 'utf8');

const rules = redirects
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [source, destination, status] = line.split(/\s+/);
    return { source, destination, status };
  });

const fallbackSource = '/mask-unmask/*';
const fallbackIndex = rules.findIndex(({ source }) => source === fallbackSource);
if (fallbackIndex === -1 || rules[fallbackIndex].destination !== '/mask-unmask/index.html' || rules[fallbackIndex].status !== '200') {
  throw new Error('dist/_redirects is missing the Mask & Unmask SPA fallback');
}

const exclusionSources = [
  '/mask-unmask/assets/*',
  '/mask-unmask/favicon.svg',
  '/mask-unmask/favicon-32.png',
  '/mask-unmask/apple-touch-icon.png',
  '/mask-unmask/digi-garden-logo.svg',
];

for (const source of exclusionSources) {
  const index = rules.findIndex((rule) => rule.source === source);
  if (index === -1 || index >= fallbackIndex) {
    throw new Error(`Static-file exclusion must precede the SPA fallback: ${source}`);
  }
}

function applyFirstMatchingRule(pathname) {
  for (const { source, destination, status } of rules) {
    if (source.endsWith('*') && pathname.startsWith(source.slice(0, -1))) {
      return {
        destination: destination.replace(':splat', pathname.slice(source.length - 1)),
        status,
      };
    }
    if (source === pathname) return { destination, status };
  }
  return null;
}

const builtAssetPaths = [...appIndex.matchAll(/(?:src|href)="(\/mask-unmask\/assets\/[^"]+)"/g)]
  .map((match) => match[1]);
if (!builtAssetPaths.some((path) => path.endsWith('.js')) || !builtAssetPaths.some((path) => path.endsWith('.css'))) {
  throw new Error('Built app index does not reference both JS and CSS assets');
}

const staticPaths = [
  ...builtAssetPaths,
  '/mask-unmask/favicon.svg',
  '/mask-unmask/favicon-32.png',
  '/mask-unmask/apple-touch-icon.png',
  '/mask-unmask/digi-garden-logo.svg',
];

for (const pathname of staticPaths) {
  const result = applyFirstMatchingRule(pathname);
  if (!result || result.destination !== pathname || result.status !== '200') {
    throw new Error(`Static request would not self-proxy before the SPA fallback: ${pathname}`);
  }
}

const fallbackResult = applyFirstMatchingRule('/mask-unmask/test-route');
if (fallbackResult?.destination !== '/mask-unmask/index.html' || fallbackResult.status !== '200') {
  throw new Error('/mask-unmask/test-route does not use the SPA fallback');
}
