#!/usr/bin/env node
/**
 * Preserve verbatim license and notice files for installed runtime-classified
 * dependencies in the static distribution. Do not substitute SPDX metadata
 * for the original copyright/permission text.
 *
 * This does not establish complete bundle provenance or legal compliance.
 */
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve('.');
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
const packages = Object.entries(lock.packages ?? {})
  .filter(([path, metadata]) => path.startsWith('node_modules/') && metadata.dev !== true)
  .sort(([a], [b]) => a.localeCompare(b));

if (packages.length === 0) throw new Error('No runtime dependencies found: cannot produce license notices');

const dest = join(root, 'dist', 'mask-unmask', 'third-party-licenses');
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
const manifest = [
  '# Runtime dependency license and notice files',
  '',
  'Runtime npm dependencies are listed first; build-time CSS-origin code is listed separately below.',
  'Verbatim files copied from the installed npm packages for this build.',
  'Package metadata and a copied file alone do not prove complete OSS compliance.',
  '',
];

for (const [path, metadata] of packages) {
  const packageName = path.slice('node_modules/'.length);
  // Only use relative npm package identifiers; never trust a lockfile path for output traversal.
  if (!/^(?:@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/.test(packageName)) {
    throw new Error(`Unexpected package identifier: ${packageName}`);
  }
  const version = metadata.version;
  if (typeof version !== 'string' || !/^[0-9A-Za-z.+_-]+$/.test(version)) {
    throw new Error(`Invalid version for ${packageName}`);
  }
  const packageDir = join(root, path);
  const files = (await readdir(packageDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^(?:licen[cs]e|copying|notice)(?:[.\-_].*)?$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (files.length === 0) {
    throw new Error(`Missing LICENSE/COPYING/NOTICE original in ${path}`);
  }
  const prefix = packageName.replaceAll('/', '__') + '-' + version + '-';
  manifest.push(`## ${packageName}@${version} (lockfile: ${metadata.license ?? 'UNKNOWN'})`);
  for (const name of files) {
    const target = prefix + name;
    await copyFile(join(packageDir, name), join(dest, target));
    manifest.push(`- ${target}`);
  }
  manifest.push('');
}

// The public digi-garden SVG embeds the Manrope font as base64 WOFF2 data.
// Preserve the upstream SIL OFL notice next to npm dependency notices.
const manropeNotice = 'Manrope-OFL.txt';
await copyFile(join(root, 'licenses', 'manrope', 'OFL.txt'), join(dest, manropeNotice));
manifest.push('## Embedded Manrope font (SIL Open Font License 1.1)');
manifest.push('The digi-garden logo embeds a Manrope font payload; this notice covers that font.');
manifest.push('Source: https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt');
manifest.push('Notice file: ' + manropeNotice);
manifest.push('');


 // Tailwind's preflight CSS is present in the generated stylesheet even though
 // tailwindcss is classified as a development dependency in the lockfile.
 // Copy its original notice separately; do not reclassify all dev dependencies.
 const tailwind = lock.packages?.['node_modules/tailwindcss'];
 if (!tailwind || typeof tailwind.version !== 'string' || !/^[0-9A-Za-z.+_-]+$/.test(tailwind.version)) {
   throw new Error('Missing or invalid tailwindcss lockfile version');
 }
 const tailwindFiles = (await readdir(join(root, 'node_modules', 'tailwindcss'), { withFileTypes: true }))
   .filter((entry) => entry.isFile() && /^(?:licen[cs]e|copying|notice)(?:[.\\-_].*)?$/i.test(entry.name))
   .map((entry) => entry.name).sort();
 if (tailwindFiles.length === 0) throw new Error('Missing original tailwindcss license notice');
 manifest.push('## Build-time CSS-origin code (included in generated CSS)');
 manifest.push('');
 manifest.push(`### tailwindcss@${tailwind.version} (lockfile: ${tailwind.license ?? 'UNKNOWN'}; build-time CSS)`);
 for (const name of tailwindFiles) {
   const target = `tailwindcss-${tailwind.version}-${name}`;
   await copyFile(join(root, 'node_modules', 'tailwindcss', name), join(dest, target));
   manifest.push(`- ${target}`);
 }
 manifest.push('');
 
await writeFile(join(dest, 'README.md'), manifest.join('\n'), 'utf8');
console.log(`Copied original notice files for ${packages.length} runtime-classified packages into dist/mask-unmask/third-party-licenses/`);
