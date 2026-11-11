#!/usr/bin/env node
/**
 * Gate A5: inspect textual files in the actual built distribution for
 * recognizable high-risk credentials. Only print rule names and file paths,
 * never matching contents. This is a targeted scan, not proof that arbitrary
 * secrets cannot be encoded or embedded.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, relative, extname } from 'node:path';

const root = resolve('dist');
const textual = new Set([
  '.html', '.htm', '.js', '.mjs', '.css', '.json', '.txt',
  '.md', '.svg', '.xml', '.webmanifest', '.map', '.yml', '.yaml',
  '.toml', '.ini', '.env',
]);
const rules = [
  ['private-key-pem', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
  ['github-token', /gh(?:p|o|u|s|r)_[A-Za-z0-9_]{28,}/g],
  ['github-fine-grained-token', /github_pat_[A-Za-z0-9_]{50,}/g],
  ['aws-access-key', /(?:AKIA|ASIA)[A-Z0-9]{16}/g],
  ['google-api-key', /AIza[0-9A-Za-z_-]{35}/g],
  ['slack-token', /xox[baprs]-[0-9A-Za-z-]{20,}/g],
  ['stripe-live-secret', /sk_live_[0-9A-Za-z]{20,}/g],
  ['openai-key', /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g],
  ['credential-assignment', /\b(?:client_secret|access_token|private_key|secret_key|password)\b\s*[:=]\s*["'][A-Za-z0-9_+\/=.-]{24,}["']/gi],
];
let files = 0;
let bytes = 0;
let skippedBinary = 0;
const findings = [];
async function walk(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const pathname = join(folder, entry.name);
    if (entry.isDirectory()) {
      await walk(pathname);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!textual.has(extname(entry.name).toLowerCase()) &&
      !['_headers', '_redirects', '.nojekyll'].includes(entry.name)) {
      skippedBinary++;
      continue;
    }
    const data = await readFile(pathname);
    if (data.includes(0)) {
      skippedBinary++;
      continue;
    }
    const contents = data.toString('utf8');
    files++;
    bytes += data.length;
    for (const [name, pattern] of rules) {
      pattern.lastIndex = 0;
      if (pattern.test(contents)) {
        findings.push({ path: relative(root, pathname).split('\\').join('/'), rule: name });
      }
    }
  }
}
await walk(root);
if (files === 0) {
  console.error('FAIL: no textual distribution assets were scanned');
  process.exitCode = 1;
} else if (findings.length) {
  for (const finding of findings) console.error(`FAIL: ${finding.path}: ${finding.rule}`);
  console.error(`FAIL: ${findings.length} potentially exposed credential pattern(s) detected; no values printed`);
  process.exitCode = 1;
} else {
  console.log(`PASS: dist/ secret pattern scan; ${files} text assets, ${bytes} bytes, ${skippedBinary} binary/other assets excluded, 0 findings`);
}
