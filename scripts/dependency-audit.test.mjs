import { describe, expect, it } from 'vitest';
import { evaluateAuditResult, evaluateOutdatedResult } from './dependency-audit.mjs';

/** @param {Record<string, number>} [overrides] */
function makeAuditJson(overrides = {}) {
  const counts = {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    info: 0,
    total: 0,
    ...overrides,
  };
  return JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: {
      vulnerabilities: counts,
    },
  });
}

describe('evaluateAuditResult', () => {
  it('passes when exitCode is 0 and total vulnerabilities is 0', () => {
    const res = evaluateAuditResult({ exitCode: 0, rawOutput: makeAuditJson() });
    expect(res.ok).toBe(true);
    expect(res.reason).toBe('no-vulnerabilities');
    expect(res.summary).toContain('| **Total** | **0** |');
  });

  it('passes when exitCode is 1 and only low vulnerabilities exist', () => {
    const res = evaluateAuditResult({
      exitCode: 1,
      rawOutput: makeAuditJson({ low: 2, total: 2 }),
    });
    expect(res.ok).toBe(true);
    expect(res.reason).toBe('low-or-info-only');
  });

  it('fails when moderate vulnerabilities are detected', () => {
    const res = evaluateAuditResult({
      exitCode: 1,
      rawOutput: makeAuditJson({ moderate: 1, total: 1 }),
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('moderate-or-higher-detected');
  });

  it('fails when high vulnerabilities are detected', () => {
    const res = evaluateAuditResult({
      exitCode: 1,
      rawOutput: makeAuditJson({ high: 3, total: 3 }),
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('moderate-or-higher-detected');
  });

  it('fails when critical vulnerabilities are detected', () => {
    const res = evaluateAuditResult({
      exitCode: 1,
      rawOutput: makeAuditJson({ critical: 1, total: 1 }),
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('moderate-or-higher-detected');
  });

  it('fails when npm audit exits with an unexpected exit code', () => {
    const res = evaluateAuditResult({ exitCode: 2, rawOutput: makeAuditJson() });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('unexpected-exit-code');
  });

  it('fails when npm audit JSON is malformed', () => {
    const res = evaluateAuditResult({ exitCode: 1, rawOutput: '{not-valid-json' });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('invalid-json');
  });

  it('fails when npm audit output is empty', () => {
    const res = evaluateAuditResult({ exitCode: 0, rawOutput: '   ' });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('empty-output');
  });

  it('fails when required vulnerability fields are missing', () => {
    const incomplete = JSON.stringify({
      metadata: { vulnerabilities: { critical: 0, high: 0, total: 0 } },
    });
    const res = evaluateAuditResult({ exitCode: 0, rawOutput: incomplete });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('missing-fields');
  });

  it('fails when npm audit returns an API error payload', () => {
    const apiError = JSON.stringify({ error: { code: 'ENETUNREACH', summary: 'network error' } });
    const res = evaluateAuditResult({ exitCode: 1, rawOutput: apiError });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('audit-api-error');
  });

  it('fails when exitCode and JSON vulnerability total are inconsistent', () => {
    const zeroWithExit1 = evaluateAuditResult({ exitCode: 1, rawOutput: makeAuditJson() });
    expect(zeroWithExit1.ok).toBe(false);
    expect(zeroWithExit1.reason).toBe('exit-json-mismatch');

    const nonZeroWithExit0 = evaluateAuditResult({
      exitCode: 0,
      rawOutput: makeAuditJson({ low: 1, total: 1 }),
    });
    expect(nonZeroWithExit0.ok).toBe(false);
    expect(nonZeroWithExit0.reason).toBe('exit-json-mismatch');
  });
});

describe('evaluateOutdatedResult', () => {
  it('reports up-to-date when exitCode is 0 and output is empty JSON', () => {
    const res = evaluateOutdatedResult({ exitCode: 0, rawOutput: '{}' });
    expect(res.warning).toBe(false);
    expect(res.summary).toContain('All direct dependencies are up to date.');
  });

  it('reports outdated packages without failing when exitCode is 1', () => {
    const payload = JSON.stringify({
      typescript: { current: '6.0.3', wanted: '6.0.3', latest: '7.0.2' },
    });
    const res = evaluateOutdatedResult({ exitCode: 1, rawOutput: payload });
    expect(res.warning).toBe(false);
    expect(res.packages).toHaveLength(1);
    expect(res.summary).toContain('| typescript | 6.0.3 | 6.0.3 | 7.0.2 |');
  });

  it('emits a warning instead of claiming up-to-date on unexpected exit code or invalid JSON', () => {
    const errExit = evaluateOutdatedResult({ exitCode: 2, rawOutput: '' });
    expect(errExit.warning).toBe(true);
    expect(errExit.summary).not.toContain('All direct dependencies are up to date.');

    const badJson = evaluateOutdatedResult({ exitCode: 1, rawOutput: 'bad-json' });
    expect(badJson.warning).toBe(true);
    expect(badJson.summary).not.toContain('All direct dependencies are up to date.');
  });
});
