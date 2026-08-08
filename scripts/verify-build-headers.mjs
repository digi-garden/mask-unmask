import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_HEADERS = new Map([
  ['cache-control', 'public, max-age=0, must-revalidate, no-transform'],
  ['content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'"],
  ['x-content-type-options', 'nosniff'],
  ['referrer-policy', 'no-referrer'],
]);

export function parseHeadersRules(content) {
  const rules = [];
  let currentRule = null;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (!/^\s/.test(line)) {
      currentRule = { path: trimmed, headers: [] };
      rules.push(currentRule);
      continue;
    }

    if (!currentRule) {
      throw new Error(`Header appears before a path rule: ${trimmed}`);
    }

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex <= 0) {
      throw new Error(`Invalid header line in ${currentRule.path}: ${trimmed}`);
    }

    currentRule.headers.push({
      name: trimmed.slice(0, separatorIndex).trim().toLowerCase(),
      value: trimmed.slice(separatorIndex + 1).trim(),
    });
  }

  return rules;
}

export function verifyHeadersContent(content) {
  const wildcardRules = parseHeadersRules(content).filter(({ path }) => path === '/*');
  if (wildcardRules.length !== 1) {
    throw new Error(`Expected exactly one /* rule, found ${wildcardRules.length}`);
  }

  const wildcardRule = wildcardRules[0];
  for (const [requiredName, requiredValue] of REQUIRED_HEADERS) {
    const matchingHeaders = wildcardRule.headers.filter(({ name }) => name === requiredName);
    if (matchingHeaders.length !== 1) {
      throw new Error(`Expected exactly one ${requiredName} header in /*, found ${matchingHeaders.length}`);
    }
    if (matchingHeaders[0].value !== requiredValue) {
      throw new Error(`Unexpected ${requiredName} value in /*: ${matchingHeaders[0].value}`);
    }
  }
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const repositoryRoot = resolve(dirname(scriptPath), '..');
  const headers = await readFile(resolve(repositoryRoot, 'dist/_headers'), 'utf8');
  verifyHeadersContent(headers);
}
