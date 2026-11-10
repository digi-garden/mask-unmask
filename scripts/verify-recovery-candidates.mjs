#!/usr/bin/env node
/**
 * MU-COMP-004/008: read-only inspection of two known Cloudflare Pages deployments.
 * No Cloudflare token, API write, changes to production, or synthetic user input.
 * Does NOT certify that a rollback itself succeeds.
 */
import { createHash } from 'node:crypto';

const candidates = [
  {
    label: 'current-observed-production',
    commit: 'b7244babaf225d98d7a14e4c0344a6207b50033e',
    deployment: '1f73eb57-db3b-4309-9182-7de2e8563933',
    url: 'https://1f73eb57.mask-unmask.pages.dev/mask-unmask/',
  },
  {
    label: 'previous-successful-production',
    commit: '009fd43c35e8e98b2c61994439f21adc1acdd388',
    deployment: 'e495e78b-d243-4463-8a73-e7e52d7dcc6b',
    url: 'https://e495e78b.mask-unmask.pages.dev/mask-unmask/',
  },
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function request(url) {
  const response = await fetch(url, {
    redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Accept: 'text/html,application/javascript,text/css,*/*' },
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length) throw new Error('empty response');
  return { response, data };
}

let failures = 0;
for (const item of candidates) {
  const url = new URL(item.url);
  // Exact expected host: do not let configuration or redirects change the target.
  if (url.host !== item.deployment.slice(0, 8) + '.mask-unmask.pages.dev' ||
      url.pathname !== '/mask-unmask/' || url.protocol !== 'https:') {
    throw new Error('Candidate deployment URL mismatch: ' + item.label);
  }
  try {
    const { response, data } = await request(url);
    const html = data.toString('utf8');
    if (!/^text\/html/i.test(response.headers.get('content-type') ?? '')) {
      throw new Error('not an HTML page');
    }
    if (!/<title[^>]*>/i.test(html)) throw new Error('missing HTML title');
    if (!/Mask\s*(?:&|&amp;)\s*Unmask/i.test(html)) throw new Error('missing product title');
    // Look for hashed /assets JS, resolve against the deployment-local path.
    const js = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["']/gi)]
      .map((match) => match[1])[0];
    if (!js) throw new Error('missing app script reference');
    const assetUrl = new URL(js, url);
    if (assetUrl.origin !== url.origin || !assetUrl.pathname.startsWith('/mask-unmask/assets/')) {
      throw new Error('app script escapes version-specific app asset scope');
    }
    const asset = await request(assetUrl);
    if (/(?:text\/html)/i.test(asset.response.headers.get('content-type') ?? '')) {
      throw new Error('asset returned HTML fallback');
    }
    console.log(JSON.stringify({
      label: item.label, expectedCommit: item.commit, deploymentId: item.deployment,
      inspectedUrl: url.href, htmlSha256: sha256(data), jsPath: assetUrl.pathname,
      jsSha256: sha256(asset.data), bytes: { html: data.length, js: asset.data.length },
      check: 'PASS: candidate direct URL and version-local asset readable',
    }));
  } catch (error) {
    failures++;
    console.error(JSON.stringify({
      label: item.label, deploymentId: item.deployment, check: 'FAIL',
      error: error.message,
    }));
  }
}
if (failures) process.exitCode = 1;
else console.log('NOTE: Read-only asset checks passed. No rollback, no production/domain routing, no access rights or cache recovery tested.');
