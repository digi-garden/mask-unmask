#!/usr/bin/env node
/**
 * Audits the lockfile manifest only. Does not claim licenses are compliant,
 * license text is present, or a dependency is included in the deployed bundle.
 * It does not download packages or modify the repository.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const lockfile = JSON.parse(await readFile(resolve('package-lock.json'), 'utf8'));
if (lockfile.lockfileVersion !== 3 || !lockfile.packages || !lockfile.packages['']) {
  throw new Error('Expected npm package-lock v3 with a root package entry');
}

const items = Object.entries(lockfile.packages)
  .filter(([path]) => path.startsWith('node_modules/'))
  .map(([path, metadata]) => {
    const dependency = path.slice('node_modules/'.length);
    return {
      dependency,
      version: metadata.version ?? null,
      license: typeof metadata.license === 'string' ? metadata.license.trim() : null,
      development: metadata.dev === true,
      optional: metadata.optional === true,
    };
  })
  .sort((a, b) => a.dependency.localeCompare(b.dependency));

const runtime = items.filter((item) => !item.development);
const development = items.filter((item) => item.development);
const unknown = items.filter((item) => !item.license);
const unknownRuntime = unknown.filter((item) => !item.development);
const interesting = items.filter((item) =>
  item.license && /(?:GPL|MPL|CC-BY|AGPL|LGPL)/i.test(item.license)
);
const report = {
  source: 'package-lock.json (metadata only; not the production bundle)',
  lockfileVersion: lockfile.lockfileVersion,
  packageCount: items.length,
  runtimeManifestCount: runtime.length,
  developmentManifestCount: development.length,
  unknownLicenseCount: unknown.length,
  unknownRuntimeLicenseCount: unknownRuntime.length,
  packages: items,
};

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  console.log(`Lockfile packages: ${items.length} (runtime-flagged ${runtime.length}; dev-only ${development.length})`);
  console.log('Runtime-flagged: ' + runtime.map((x) => `${x.dependency}@${x.version} [${x.license ?? 'UNKNOWN'}]`).join(', '));
  console.log('Missing license identifiers: ' + (unknown.map((x) => `${x.dependency}@${x.version} (dev=${x.development})`).join(', ') || 'none'));
  console.log('Review licenses (not necessarily distributed): ' + (interesting.map((x) => `${x.dependency}@${x.version}: ${x.license} (dev=${x.development})`).join(', ') || 'none'));
}

if (unknownRuntime.length) {
  console.error('FAIL: runtime dependency license metadata missing; manual review required');
  process.exitCode = 1;
}
if (unknown.length && !unknownRuntime.length) {
  console.warn('REVIEW: one or more development dependency licenses lack lockfile metadata');
}
console.log('NOTE: manifest classifications do not establish effective distribution or fulfill attribution obligations.');
