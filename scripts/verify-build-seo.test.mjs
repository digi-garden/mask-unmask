import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyHeadersContent } from './verify-build-headers.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function collectSourceFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx') &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseHtmlHead(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return {
    title: doc.title,
    description: doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
    canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    ogType: doc.querySelector('meta[property="og:type"]')?.getAttribute('content') ?? null,
    ogTitle: doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? null,
    ogDescription:
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ?? null,
    ogUrl: doc.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? null,
    ogSiteName:
      doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? null,
    ogImage: doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null,
    twitterCard: doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content') ?? null,
    scripts: [...doc.querySelectorAll('script')].map((s) => ({
      src: s.getAttribute('src'),
      text: s.textContent ?? '',
    })),
    links: [...doc.querySelectorAll('link')].map((l) => ({
      rel: l.getAttribute('rel'),
      href: l.getAttribute('href'),
    })),
  };
}

describe('SEO & Static Security Verification (SEO-01〜04 / SEC-SEO-01〜04)', () => {
  it('アプリホーム index.html に適切な title, description, canonical, OGP, twitter:card が静的に設定されていること (SEO-01)', async () => {
    const html = await readFile(resolve(repositoryRoot, 'index.html'), 'utf8');
    const head = parseHtmlHead(html);

    expect(head.title).toBe('Mask & Unmask | ブラウザでテキストを仮名化・復元');
    expect(head.description).toBe(
      'メールアドレスや電話番号、IPアドレス、APIキー、任意の語句を含む文章をブラウザ内で仮名化し、必要に応じて復元できる無料Webツール。入力テキストや置換マップは外部へ送信しない設計です。'
    );
    expect(head.canonical).toBe('https://circle-note.com/mask-unmask/');
    expect(head.ogType).toBe('website');
    expect(head.ogTitle).toBe(head.title);
    expect(head.ogDescription).toBe(head.description);
    expect(head.ogUrl).toBe('https://circle-note.com/mask-unmask/');
    expect(head.ogSiteName).toBe('CircleNote');
    expect(head.twitterCard).toBe('summary');
    expect(head.ogImage).toBeNull();
  });

  it('CircleNoteルート circle-note/index.html に canonical, title, description, OGP が設定され、アプリホームと重複しないこと (SEO-03)', async () => {
    const rootHtml = await readFile(resolve(repositoryRoot, 'circle-note/index.html'), 'utf8');
    const appHtml = await readFile(resolve(repositoryRoot, 'index.html'), 'utf8');
    const rootHead = parseHtmlHead(rootHtml);
    const appHead = parseHtmlHead(appHtml);

    expect(rootHead.title).toBe('CircleNote | ブラウザで使えるテキスト仮名化ツール');
    expect(rootHead.description).toBe(
      'CircleNoteが提供する、ブラウザ内で完結する機密情報の仮名化・復元ツールです。'
    );
    expect(rootHead.canonical).toBe('https://circle-note.com/');
    expect(rootHead.ogType).toBe('website');
    expect(rootHead.ogTitle).toBe(rootHead.title);
    expect(rootHead.ogDescription).toBe(rootHead.description);
    expect(rootHead.ogUrl).toBe('https://circle-note.com/');
    expect(rootHead.ogSiteName).toBe('CircleNote');
    expect(rootHead.twitterCard).toBe('summary');

    expect(rootHead.title).not.toBe(appHead.title);
    expect(rootHead.description).not.toBe(appHead.description);
    expect(rootHead.canonical).not.toBe(appHead.canonical);
  });

  it('robots.txt と sitemap.xml が正規2URLのみを含み、canonicalと完全一致し、安全性ページや不要タグを含まないこと (SEO-02 & SEO-04)', async () => {
    const robots = await readFile(resolve(repositoryRoot, 'circle-note/robots.txt'), 'utf8');
    const sitemap = await readFile(resolve(repositoryRoot, 'circle-note/sitemap.xml'), 'utf8');
    const rootHtml = await readFile(resolve(repositoryRoot, 'circle-note/index.html'), 'utf8');
    const appHtml = await readFile(resolve(repositoryRoot, 'index.html'), 'utf8');

    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://circle-note.com/sitemap.xml');

    const locMatches = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locMatches).toEqual([
      'https://circle-note.com/',
      'https://circle-note.com/mask-unmask/',
    ]);

    const rootCanonical = parseHtmlHead(rootHtml).canonical;
    const appCanonical = parseHtmlHead(appHtml).canonical;
    expect(locMatches).toEqual([rootCanonical, appCanonical]);

    expect(sitemap).not.toContain('safety-and-privacy');
    expect(sitemap).not.toContain('<lastmod>');
    expect(sitemap).not.toContain('<changefreq>');
    expect(sitemap).not.toContain('<priority>');
  });

  it('ビルド出力 dist/ が存在する場合、ルートに robots.txt / sitemap.xml / _headers / _redirects が配置され、/mask-unmask/ 配下に誤配置されていないこと', async () => {
    const distRoot = resolve(repositoryRoot, 'dist');
    if (!existsSync(distRoot)) {
      return;
    }

    const distRootHtml = await readFile(resolve(distRoot, 'index.html'), 'utf8');
    const distAppHtml = await readFile(resolve(distRoot, 'mask-unmask/index.html'), 'utf8');
    const distRobots = await readFile(resolve(distRoot, 'robots.txt'), 'utf8');
    const distSitemap = await readFile(resolve(distRoot, 'sitemap.xml'), 'utf8');
    const distHeaders = await readFile(resolve(distRoot, '_headers'), 'utf8');
    const distRedirects = await readFile(resolve(distRoot, '_redirects'), 'utf8');

    expect(parseHtmlHead(distRootHtml).canonical).toBe('https://circle-note.com/');
    expect(parseHtmlHead(distAppHtml).canonical).toBe('https://circle-note.com/mask-unmask/');
    expect(distRobots).toContain('Sitemap: https://circle-note.com/sitemap.xml');
    expect([...distSitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([
      'https://circle-note.com/',
      'https://circle-note.com/mask-unmask/',
    ]);

    expect(existsSync(resolve(distRoot, 'mask-unmask/robots.txt'))).toBe(false);
    expect(existsSync(resolve(distRoot, 'mask-unmask/sitemap.xml'))).toBe(false);

    verifyHeadersContent(distHeaders);
    expect(distRedirects.trim()).toBe('/mask-unmask /mask-unmask/ 301');
  });

  it('アプリ実装コードに外部通信API・永続ストレージAPI・外部トラッキングが存在しないこと (SEC-SEO-01 / SEC-SEO-02 / SEC-SEO-04)', async () => {
    const srcFiles = await collectSourceFiles(resolve(repositoryRoot, 'src'));
    expect(srcFiles.length).toBeGreaterThan(0);

    for (const filePath of srcFiles) {
      const code = await readFile(filePath, 'utf8');

      // 外部通信APIの不使用確認 (SEC-SEO-01)
      expect(code).not.toMatch(/\bfetch\s*\(/);
      expect(code).not.toMatch(/\bXMLHttpRequest\b/);
      expect(code).not.toMatch(/\bsendBeacon\b/);
      expect(code).not.toMatch(/\bnew\s+WebSocket\b/);
      expect(code).not.toMatch(/\bnew\s+EventSource\b/);

      // 永続ストレージAPIの不使用確認 (SEC-SEO-02)
      expect(code).not.toMatch(/\blocalStorage\s*\./);
      expect(code).not.toMatch(/\bindexedDB\s*\./);
      expect(code).not.toMatch(/\bdocument\.cookie\b/);
    }

    // HTMLに外部スクリプト・外部フォント・解析タグが含まれないこと (SEC-SEO-04)
    for (const relPath of ['index.html', 'circle-note/index.html']) {
      const html = await readFile(resolve(repositoryRoot, relPath), 'utf8');
      const head = parseHtmlHead(html);

      for (const script of head.scripts) {
        if (script.src) {
          expect(script.src).not.toMatch(/^https?:\/\//i);
        }
        expect(script.text).not.toMatch(/googletagmanager|google-analytics|gtag\s*\(/i);
      }

      for (const link of head.links) {
        if (link.rel !== 'canonical' && link.href) {
          expect(link.href).not.toMatch(/^https?:\/\//i);
          expect(link.href).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/i);
        }
      }
    }
  });
});
