import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SEVERITY_KEYS = ['critical', 'high', 'moderate', 'low', 'info', 'total'];

/**
 * Evaluate `npm audit --json` output alongside its process exit code.
 * Fails on moderate+ vulnerabilities, unexpected exit codes, invalid/empty JSON,
 * API errors, missing metadata fields, or exit-code/JSON mismatches.
 */
export function evaluateAuditResult({ exitCode, rawOutput }) {
  if (!Number.isInteger(exitCode) || (exitCode !== 0 && exitCode !== 1)) {
    return {
      ok: false,
      reason: 'unexpected-exit-code',
      message: `Unexpected npm audit exit code: ${exitCode}`,
      counts: null,
      summary: `## npm audit Summary\n\nError: Unexpected \`npm audit\` exit code (${exitCode}).\n`,
    };
  }

  const trimmed = typeof rawOutput === 'string' ? rawOutput.trim() : '';
  if (!trimmed) {
    return {
      ok: false,
      reason: 'empty-output',
      message: `npm audit --json produced empty output (exit: ${exitCode}).`,
      counts: null,
      summary: `## npm audit Summary\n\nError: \`npm audit --json\` produced empty output (exit: ${exitCode}).\n`,
    };
  }

  let report;
  try {
    report = JSON.parse(trimmed);
  } catch (err) {
    return {
      ok: false,
      reason: 'invalid-json',
      message: `Failed to parse npm audit --json output: ${err.message}`,
      counts: null,
      summary: '## npm audit Summary\n\nError: Failed to parse `npm audit --json` output.\n',
    };
  }

  if (!report || typeof report !== 'object' || report.error) {
    return {
      ok: false,
      reason: 'audit-api-error',
      message: `npm audit returned an error: ${JSON.stringify(report?.error ?? 'invalid report')}`,
      counts: null,
      summary: '## npm audit Summary\n\nError: `npm audit` returned an API/registry error.\n',
    };
  }

  const vulns = report.metadata?.vulnerabilities;
  if (!vulns || typeof vulns !== 'object') {
    return {
      ok: false,
      reason: 'missing-fields',
      message: 'npm audit metadata.vulnerabilities is missing.',
      counts: null,
      summary: '## npm audit Summary\n\nError: `metadata.vulnerabilities` is missing from `npm audit` output.\n',
    };
  }

  for (const key of SEVERITY_KEYS) {
    if (typeof vulns[key] !== 'number' || !Number.isFinite(vulns[key]) || vulns[key] < 0) {
      return {
        ok: false,
        reason: 'missing-fields',
        message: `npm audit metadata.vulnerabilities.${key} is missing or invalid.`,
        counts: null,
        summary: `## npm audit Summary\n\nError: \`metadata.vulnerabilities.${key}\` is missing or invalid.\n`,
      };
    }
  }

  const counts = {
    critical: vulns.critical,
    high: vulns.high,
    moderate: vulns.moderate,
    low: vulns.low,
    info: vulns.info,
    total: vulns.total,
  };

  if ((exitCode === 0 && counts.total > 0) || (exitCode === 1 && counts.total === 0)) {
    return {
      ok: false,
      reason: 'exit-json-mismatch',
      message: `Inconsistent npm audit result: exitCode=${exitCode}, total=${counts.total}.`,
      counts,
      summary: `## npm audit Summary\n\nError: Inconsistent \`npm audit\` exit code (${exitCode}) and JSON total (${counts.total}).\n`,
    };
  }

  const summary = [
    '## npm audit Summary',
    '',
    '| Severity | Count |',
    '| :--- | ---: |',
    `| Critical | ${counts.critical} |`,
    `| High | ${counts.high} |`,
    `| Moderate | ${counts.moderate} |`,
    `| Low | ${counts.low} |`,
    `| Info | ${counts.info} |`,
    `| **Total** | **${counts.total}** |`,
    '',
  ].join('\n');

  if (counts.critical + counts.high + counts.moderate > 0) {
    return {
      ok: false,
      reason: 'moderate-or-higher-detected',
      message: `Audit failed: detected ${counts.critical} critical, ${counts.high} high, ${counts.moderate} moderate vulnerabilities.`,
      counts,
      summary,
    };
  }

  return {
    ok: true,
    reason: counts.total === 0 ? 'no-vulnerabilities' : 'low-or-info-only',
    message: counts.total === 0 ? 'No vulnerabilities detected.' : 'Only low/info vulnerabilities detected.',
    counts,
    summary,
  };
}

/**
 * Evaluate `npm outdated --json` output alongside its process exit code.
 * Never fails the workflow when updates exist, and emits a clear warning
 * instead of falsely reporting "up to date" on network/JSON errors.
 */
export function evaluateOutdatedResult({ exitCode, rawOutput }) {
  if (!Number.isInteger(exitCode) || (exitCode !== 0 && exitCode !== 1)) {
    return {
      warning: true,
      packages: [],
      summary: `## npm outdated (Informational)\n\n> [!WARNING]\n> \`npm outdated\` exited unexpectedly with code ${exitCode}; outdated status could not be determined.\n`,
    };
  }

  const trimmed = typeof rawOutput === 'string' ? rawOutput.trim() : '';
  if (!trimmed) {
    if (exitCode === 1) {
      return {
        warning: true,
        packages: [],
        summary: '## npm outdated (Informational)\n\n> [!WARNING]\n> `npm outdated --json` exited with code 1 but produced empty output; outdated status could not be determined.\n',
      };
    }
    return {
      warning: false,
      packages: [],
      summary: '## npm outdated (Informational)\n\nAll direct dependencies are up to date.\n',
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      warning: true,
      packages: [],
      summary: `## npm outdated (Informational)\n\n> [!WARNING]\n> Failed to parse \`npm outdated --json\` output (${err.message}); outdated status could not be determined.\n`,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.error) {
    return {
      warning: true,
      packages: [],
      summary: '## npm outdated (Informational)\n\n> [!WARNING]\n> `npm outdated --json` returned an error or unexpected payload.\n',
    };
  }

  const entries = Object.entries(parsed);
  const lines = ['## npm outdated (Informational)', ''];
  if (entries.length === 0) {
    lines.push('All direct dependencies are up to date.');
  } else {
    lines.push('| Package | Current | Wanted | Latest |');
    lines.push('| :--- | :--- | :--- | :--- |');
    for (const [name, info] of entries) {
      lines.push(`| ${name} | ${info?.current ?? '-'} | ${info?.wanted ?? '-'} | ${info?.latest ?? '-'} |`);
    }
  }
  lines.push('');

  return {
    warning: false,
    packages: entries.map(([name, info]) => ({ name, ...info })),
    summary: lines.join('\n'),
  };
}

function appendStepSummary(text) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n', 'utf8');
  }
}

function runCli() {
  const mode = process.argv[2];
  const filePath = process.argv[3];
  if (!mode || !filePath) {
    console.error('Usage: node scripts/dependency-audit.mjs <audit|outdated> <json-file>');
    process.exit(1);
  }

  const rawOutput = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';

  if (mode === 'audit') {
    const rawExit = process.env.AUDIT_EXIT;
    const exitCode = rawExit !== undefined && rawExit !== '' ? Number(rawExit) : NaN;
    const result = evaluateAuditResult({ exitCode, rawOutput });
    console.log(result.summary);
    appendStepSummary(result.summary);
    if (!result.ok) {
      console.error(result.message);
      process.exit(1);
    }
    return;
  }

  if (mode === 'outdated') {
    const rawExit = process.env.OUTDATED_EXIT;
    const exitCode = rawExit !== undefined && rawExit !== '' ? Number(rawExit) : NaN;
    const result = evaluateOutdatedResult({ exitCode, rawOutput });
    console.log(result.summary);
    appendStepSummary(result.summary);
    if (result.warning) {
      console.warn('Warning: npm outdated did not complete cleanly.');
    }
    return;
  }

  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
