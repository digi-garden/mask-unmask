#!/usr/bin/env node
/**
 * Reproducible local-distribution evidence for MU-COMP-005.
 *
 * Inspect installed runtime package license files and hash actual dist files.
 * This does NOT establish which upstream code is bundled, copyright notice
 * obligations, or legal approval. In particular, dev-only build tools may
 * contribute code or assets to dist.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

const root = resolve('.');
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
const packages = Object.entries(lock.packages ?? {})
  .filter(([path, meta]) => path.startsWith('node_modules/') && meta.dev !== true)
  .map(([path, meta]) => ({ path, version: meta.version ?? 'unknown', license: meta.license ?? null }))
  .sort((a, b) => a.path.localeCompare(b.path));

async function digest(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

const runtimeLicenses = [];
const missing = [];
for (const pkg of packages) {
  const folder = join(root, pkg.path);
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch {
    missing.push(`${pkg.path}: package not installed`);
    continue;
  }
  const licenseFiles = entries
    .filter((entry) => entry.isFile() && /^(?:licen[cs]e|copying|notice)(?:[.\-_].*)?$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (licenseFiles.length === 0) {
    missing.push(`${pkg.path}: no root LICENSE/COPYING/NOTICE file`);
  }
  runtimeLicenses.push({
    package: pkg.path.slice('node_modules/'.length),
    version: pkg.version,
    lockfileLicense: pkg.license,
    files: await Promise.all(licenseFiles.map(async (name) => ({
      path: `${pkg.path}/${name}`,
      sha256: await digest(join(folder, name)),
    }))),
  });
}

const distRoot = join(root, 'dist');
const files = [];
async function walk(folder) {
  const entries = (await readdir(folder, { withFileTypes: true }))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
    } else if (entry.isFile()) {
      const info = await stat(path);
      files.push({
        path: relative(distRoot, path).replaceAll('\\', '/'),
        bytes: info.size,
        sha256: await digest(path),
      });
    }
  }
}
try {
  await walk(distRoot);
} catch (error) {
  console.error(`FAIL: production dist not available; run npm run build first: ${error.message}`);
  process.exit(1);
}
if (files.length === 0) {
  console.error('FAIL: production dist has no files');
  process.exit(1);
}

const report = {
  source: 'installed node_modules and locally built dist (not deployed production)',
  runtimeLicenseEvidence: runtimeLicenses,
  distFiles: files,
  missingRuntimeLicenseEvidence: missing,
  caveat: 'Hashes prove inspected files only; bundling origin, notice requirements, deployed bytes and legal compliance require separate review.',
};
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  console.log(`Runtime package licenses inspected: ${runtimeLicenses.length} (missing evidence: ${missing.length})`);
  for (const item of runtimeLicenses) {
    console.log(`  ${item.package}@${item.version} [${item.lockfileLicense ?? 'UNKNOWN'}]: ${item.files.map((f) => f.path).join(', ') || 'NONE'}`);
  }
  console.log(`Distribution files inventoried: ${files.length}`);
  for (const file of files) console.log(`  ${file.path} (${file.bytes} bytes, SHA256 ${file.sha256})`);
  for (const item of missing) console.error(`FAIL: ${item}`);
  console.log('NOTE: bundle attribution, distribution obligations, production deployment and license compliance remain manually unverified.');
}
if (missing.length) process.exitCode = 1;
