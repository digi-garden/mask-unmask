import { describe, expect, it } from 'vitest';
import { REQUIRED_HEADERS, verifyHeadersContent } from './verify-build-headers.mjs';

function createRule(path, headers, newline = '\n') {
  return [path, ...headers.map(([name, value]) => `  ${name}: ${value}`), ''].join(newline);
}

const requiredHeaderEntries = [...REQUIRED_HEADERS].map(([name, value]) => [name, value]);

describe('verifyHeadersContent', () => {
  it.each([
    ['LF', '\n'],
    ['CRLF', '\r\n'],
  ])('%s形式の /* 規則内に必須ヘッダーがあれば成功すること', (_label, newline) => {
    const content = createRule('/*', requiredHeaderEntries, newline);
    expect(() => verifyHeadersContent(content)).not.toThrow();
  });

  it('必須ヘッダーが別規則にある場合は失敗すること', () => {
    const [cacheControl, ...otherHeaders] = requiredHeaderEntries;
    const content = [
      createRule('/*', otherHeaders),
      createRule('/mask-unmask/*', [cacheControl]),
    ].join('\n');

    expect(() => verifyHeadersContent(content)).toThrow(/cache-control header in \/\*/);
  });

  it('/* 規則内に同名ヘッダーが重複する場合は失敗すること', () => {
    const content = createRule('/*', [
      ...requiredHeaderEntries,
      ['Cache-Control', 'private'],
    ]);

    expect(() => verifyHeadersContent(content)).toThrow(/exactly one cache-control header/);
  });
});
