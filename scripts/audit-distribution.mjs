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

// Independently verify that the notices shipped beneath the application URL
// match the actual installed package originals byte-for-byte. The copy step
// alone is not evidence that the distribution contains the correct notices.
const noticeRoot = join(distRoot, 'mask-unmask', 'third-party-licenses');
const copiedNoticeEvidence = [];
let publishedManifest = '';
try {
  publishedManifest = await readFile(join(noticeRoot, 'README.md'), 'utf8');
} catch {
  missing.push('dist/mask-unmask/third-party-licenses/README.md: missing public notice manifest');
}
for (const item of runtimeLicenses) {
  const identifier = item.package.replaceAll('/', '__') + '-' + item.version + '-';
  if (!publishedManifest.includes(`## ${item.package}@${item.version} (lockfile: ${item.lockfileLicense ?? 'UNKNOWN'})`)) {
    missing.push(`${item.package}@${item.version}: not listed in public notice manifest`);
  }
  for (const file of item.files) {
    const originalName = file.path.slice(file.path.lastIndexOf('/') + 1);
    const targetName = identifier + originalName;
    const outputPath = join(noticeRoot, targetName);
    const listing = `- ${targetName}`;
    if (!publishedManifest.split('\n').includes(listing)) {
      missing.push(`${item.package}: absent manifest entry for ${targetName}`);
    }
    let actualHash = null;
    try {
      actualHash = await digest(outputPath);
    } catch {
      missing.push(`${item.package}: missing distributed notice ${targetName}`);
    }
    if (actualHash !== null && actualHash !== file.sha256) {
      missing.push(`${item.package}: distributed notice differs from installed original ${targetName}`);
    }
    copiedNoticeEvidence.push({
      package: item.package,
      original: file.path,
      distributed: `mask-unmask/third-party-licenses/${targetName}`,
      originalSha256: file.sha256,
      distributedSha256: actualHash,
      matches: actualHash === file.sha256,
    });
  }
}
// Embedded Manrope font in the distributed digi-garden logo needs its own OFL notice.
const manropeOriginal = join(root, 'licenses', 'manrope', 'OFL.txt');
const manropeCopy = join(noticeRoot, 'Manrope-OFL.txt');
let manropeOriginalHash = null;
let manropeCopyHash = null;
try { manropeOriginalHash = await digest(manropeOriginal); } catch { missing.push('licenses/manrope/OFL.txt: missing original Manrope notice'); }
try { manropeCopyHash = await digest(manropeCopy); } catch { missing.push('Manrope-OFL.txt: missing distributed Manrope notice'); }
if (manropeOriginalHash !== null && manropeCopyHash !== null && manropeOriginalHash !== manropeCopyHash) {
  missing.push('Manrope-OFL.txt: notice differs from original');
}
if (!publishedManifest.includes('Notice file: Manrope-OFL.txt')) missing.push('Missing Manrope entry in notice manifest');
const logoSvg = await readFile(join(distRoot, 'mask-unmask', 'digi-garden-logo.svg'), 'utf8');
const embeddedSvgMarker = 'data:image/svg+xml;base64,';
const encodedImage = logoSvg.split(embeddedSvgMarker)[1]?.split('"')[0] ?? '';
const innerSvg = encodedImage ? Buffer.from(encodedImage, 'base64').toString('utf8') : '';
if (!innerSvg.includes('data:font/woff2;base64,')) {
  missing.push('Expected WOFF2 payload not found in nested base64 SVG in digi-garden logo; review notice applicability');
}
const manropeNoticeEvidence = { originalSha256: manropeOriginalHash, distributedSha256: manropeCopyHash, matches: manropeOriginalHash !== null && manropeOriginalHash === manropeCopyHash };

// Inspect the Rollup module graph artifact rather than trusting the build log.
const provenancePath = join(distRoot, 'mask-unmask', 'bundle-provenance.json');
let bundleProvenance = null;
try {
  bundleProvenance = JSON.parse(await readFile(provenancePath, 'utf8'));
  if (!Array.isArray(bundleProvenance.packages) || bundleProvenance.packages.length === 0) {
    missing.push('bundle-provenance.json: empty or missing package list');
  } else {
    for (const item of bundleProvenance.packages) {
      const original = lock.packages?.[`node_modules/${item.name}`];
      if (!original || original.version !== item.version || original.license !== item.license || original.dev === true || item.development || item.license !== 'MIT') {
        missing.push(`Unexpected bundle dependency metadata: ${item.name}@${item.version}`);
      }
      if (!Number.isSafeInteger(item.moduleCount) || item.moduleCount < 1) missing.push(`Invalid module count for ${item.name}`);
    }
  }
} catch (error) { missing.push(`bundle-provenance.json missing/invalid: ${error.message}`); }
// The demo video binary and project development tools must not be shipped.
for (const file of files) {
  const pathname = file.path.toLowerCase();
  const forbiddenExtension = ['.exe', '.dll', '.node', '.wasm', '.mp4', '.mov']
    .some((ext) => pathname.endsWith(ext));
  const ffmpegFile = pathname.split('/').some((part) => part === 'ffmpeg' || part.startsWith('ffmpeg-'));
  if (forbiddenExtension || ffmpegFile) {
    missing.push(`Review unexpected executable/video in static distribution: ${file.path}`);
  }
}

const expectedNoticeFiles = new Set([...copiedNoticeEvidence.map((item) => item.distributed), 'mask-unmask/third-party-licenses/Manrope-OFL.txt']);
for (const file of files) {
  if (file.path.startsWith('mask-unmask/third-party-licenses/') &&
    file.path !== 'mask-unmask/third-party-licenses/README.md' &&
    !expectedNoticeFiles.has(file.path)) {
    missing.push(`Unexpected distribution notice file: ${file.path}`);
  }
}

const report = {
  source: 'installed node_modules and locally built dist (not deployed production)',
  runtimeLicenseEvidence: runtimeLicenses,
  copiedNoticeEvidence,
  manropeNoticeEvidence,
  bundleProvenance,
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
  console.log(`Verified distributed license originals: ${copiedNoticeEvidence.filter((item) => item.matches).length}/${copiedNoticeEvidence.length}`);
  console.log(`Embedded Manrope OFL notice matches: ${manropeNoticeEvidence.matches}`);
  console.log(`Rollup package origins verified: ${bundleProvenance?.packages?.map((item) => item.name).join(', ') ?? 'NONE'}`);
  console.log(`Distribution files inventoried: ${files.length}`);
  for (const file of files) console.log(`  ${file.path} (${file.bytes} bytes, SHA256 ${file.sha256})`);
  for (const item of missing) console.error(`FAIL: ${item}`);
  console.log('NOTE: bundle attribution, distribution obligations, production deployment and license compliance remain manually unverified.');
}
if (missing.length) process.exitCode = 1;
