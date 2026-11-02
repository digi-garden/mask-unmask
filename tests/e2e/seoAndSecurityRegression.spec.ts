import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test.describe('Phase 1 SEO & Security Regression Suite (SEO-01〜05 / SEC-SEO-01〜04)', () => {
  test('SEO-01〜04: JS未実行のHTTPレスポンスで /、/mask-unmask/、/robots.txt、/sitemap.xml が正しいメタ情報・URLを返すこと', async ({
    request,
  }) => {
    // 1. /mask-unmask/ の静的HTML確認
    const appResponse = await request.get('/mask-unmask/');
    expect(appResponse.status()).toBe(200);
    const appHtml = await appResponse.text();

    expect(appHtml).toContain('<title>Mask &amp; Unmask | ブラウザでテキストを仮名化・復元</title>');
    expect(appHtml).toContain(
      'content="メールアドレスや電話番号、IPアドレス、APIキー、任意の語句を含む文章をブラウザ内で仮名化し、必要に応じて復元できる無料Webツール。入力テキストや置換マップは外部へ送信しない設計です。"'
    );
    expect(appHtml).toContain('<link rel="canonical" href="https://circle-note.com/mask-unmask/"');
    expect(appHtml).toContain('<meta property="og:type" content="website"');
    expect(appHtml).toContain(
      '<meta property="og:title" content="Mask &amp; Unmask | ブラウザでテキストを仮名化・復元"'
    );
    expect(appHtml).toContain(
      '<meta property="og:url" content="https://circle-note.com/mask-unmask/"'
    );
    expect(appHtml).toContain('<meta property="og:site_name" content="CircleNote"');
    expect(appHtml).toContain('<meta name="twitter:card" content="summary"');
    expect(appHtml).not.toContain('og:image');

    // 2. / (CircleNoteルート) の静的HTML確認
    const rootResponse = await request.get('/');
    expect(rootResponse.status()).toBe(200);
    const rootHtml = await rootResponse.text();

    expect(rootHtml).toContain(
      '<title>CircleNote | ブラウザで使えるテキスト仮名化ツール</title>'
    );
    expect(rootHtml).toContain(
      '<meta name="description" content="CircleNoteが提供する、ブラウザ内で完結する機密情報の仮名化・復元ツールです。"'
    );
    expect(rootHtml).toContain('<link rel="canonical" href="https://circle-note.com/"');
    expect(rootHtml).toContain('<meta property="og:url" content="https://circle-note.com/"');

    // 3. /robots.txt の配信確認
    const robotsResponse = await request.get('/robots.txt');
    expect(robotsResponse.status()).toBe(200);
    const robotsText = await robotsResponse.text();
    expect(robotsText).toContain('User-agent: *');
    expect(robotsText).toContain('Allow: /');
    expect(robotsText).toContain('Sitemap: https://circle-note.com/sitemap.xml');

    // 4. /sitemap.xml の配信確認
    const sitemapResponse = await request.get('/sitemap.xml');
    expect(sitemapResponse.status()).toBe(200);
    const sitemapXml = await sitemapResponse.text();
    const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([
      'https://circle-note.com/',
      'https://circle-note.com/mask-unmask/',
    ]);
    expect(sitemapXml).not.toContain('safety-and-privacy');
  });

  test('SEO-05: 用途説明・最短手順・注意事項・FAQが編集パネルの下部に配置され、操作導線を妨げないこと', async ({
    page,
  }) => {
    await page.goto('/mask-unmask/');

    const maskInputBox = await page.locator('#mask-input').boundingBox();
    const guideSection = page.locator('section[aria-labelledby="usage-guide-heading"]');
    await expect(guideSection).toBeVisible();
    const guideBox = await guideSection.boundingBox();

    expect(maskInputBox).not.toBeNull();
    expect(guideBox).not.toBeNull();
    if (maskInputBox && guideBox) {
      // 用途説明セクションは入力・編集パネルより下に配置されていること
      expect(guideBox.y).toBeGreaterThan(maskInputBox.y + maskInputBox.height);
    }

    await expect(
      guideSection.getByRole('heading', { name: 'Mask & Unmask の用途・使い方・よくある質問' })
    ).toBeVisible();
    await expect(guideSection.getByRole('heading', { name: '主な用途・使用例' })).toBeVisible();
    await expect(guideSection.getByRole('heading', { name: '最短の利用手順' })).toBeVisible();
    await expect(guideSection.getByRole('heading', { name: '利用上の注意点' })).toBeVisible();
    await expect(guideSection.getByRole('heading', { name: 'よくある質問（FAQ）' })).toBeVisible();
  });

  test('SEC-SEO-01: 仮名化・復元・コピー・JSONインポート/エクスポート操作中に外部通信が発生しないこと', async ({
    page,
  }) => {
    const apiCalls: string[] = [];
    const cspViolations: Array<{ violatedDirective: string; blockedURI: string }> = [];

    await page.exposeFunction('recordNetworkApiCall', (callName: string) => {
      apiCalls.push(callName);
    });
    await page.exposeFunction(
      'recordCspViolation',
      (v: { violatedDirective: string; blockedURI: string }) => {
        cspViolations.push(v);
      }
    );

    await page.addInitScript(() => {
      window.addEventListener('securitypolicyviolation', (e) => {
        (window as unknown as { recordCspViolation: (v: unknown) => void }).recordCspViolation({
          violatedDirective: e.violatedDirective,
          blockedURI: e.blockedURI,
        });
      });

      const wrap = <T extends (...args: never[]) => unknown>(
        obj: Record<string, unknown>,
        key: string
      ) => {
        const orig = obj[key] as T | undefined;
        if (typeof orig === 'function') {
          obj[key] = function (this: unknown, ...args: never[]) {
            (window as unknown as { recordNetworkApiCall: (k: string) => void }).recordNetworkApiCall(
              key
            );
            return orig.apply(this, args);
          };
        }
      };

      wrap(window as unknown as Record<string, unknown>, 'fetch');
      if (navigator && 'sendBeacon' in navigator) {
        wrap(navigator as unknown as Record<string, unknown>, 'sendBeacon');
      }
      const origXhrOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (...args: Parameters<typeof origXhrOpen>) {
        (window as unknown as { recordNetworkApiCall: (k: string) => void }).recordNetworkApiCall(
          'XMLHttpRequest.open'
        );
        return origXhrOpen.apply(this, args);
      };
    });

    // 初期ロード完了まで待機（初期アセット取得は除外）
    await page.goto('/mask-unmask/', { waitUntil: 'networkidle' });
    await expect(page.locator('#mask-input')).toBeVisible();

    const postLoadRequests: string[] = [];
    const postLoadFailedRequests: string[] = [];
    const postLoadWebSockets: string[] = [];

    page.on('request', (req) => {
      // ダウンロード用のローカル blob: URL 以外はすべて記録
      if (!req.url().startsWith('blob:')) {
        postLoadRequests.push(`${req.method()} ${req.url()}`);
      }
    });
    page.on('requestfailed', (req) => {
      postLoadFailedRequests.push(`${req.method()} ${req.url()}`);
    });
    page.on('websocket', (ws) => {
      postLoadWebSockets.push(ws.url());
    });

    // 1. 仮名化操作（自動検出 + カスタム単語登録）
    await page
      .locator('#mask-input')
      .fill('連絡先: fictional-sec01@example.org / IP: 192.0.2.55 / 担当: 架空山田太郎');
    await expect(page.locator('#mask-output')).toHaveValue(
      /\[CN_EMAIL_0001\].*\[CN_IPV4_0001\]/
    );

    await page.locator('#custom-original').fill('架空山田太郎');
    await page.getByRole('button', { name: '登録を追加' }).click();
    await expect(page.locator('#mask-output')).toHaveValue(
      /\[CN_EMAIL_0001\].*\[CN_IPV4_0001\].*\[CN_CUSTOM_0001\]/
    );

    // 2. 仮名化結果のコピー
    await page.locator('#panel-mask button:has-text("コピー (Copy)")').click();

    // 3. 復元タブへ切り替え・復元・コピー
    await page.locator('#tab-unmask').click();
    await page
      .locator('#unmask-input')
      .fill('復元確認: [CN_EMAIL_0001] / [CN_IPV4_0001] / [CN_CUSTOM_0001]');
    await expect(page.locator('#unmask-output')).toHaveValue(
      '復元確認: fictional-sec01@example.org / 192.0.2.55 / 架空山田太郎'
    );
    await page.locator('#panel-unmask button:has-text("コピー (Copy)")').click();

    // 4. JSONエクスポート操作
    await page.getByRole('button', { name: 'マップエクスポート' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '同意してエクスポート' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^mask-unmask-map-.*\.json$/);

    // 5. JSONインポート操作
    const importPayload = JSON.stringify({
      version: '1.0',
      createdAt: '2026-11-02T00:00:00Z',
      mappings: [
        {
          tag: '[CN_EMAIL_0002]',
          original: 'imported-sec01@example.org',
          category: 'EMAIL',
        },
      ],
    });
    await page.locator('input[aria-label="マッピングファイルをインポート"]').setInputFiles({
      name: 'test-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importPayload, 'utf8'),
    });
    await page.getByRole('button', { name: 'インポート確定' }).click();

    // すべての操作を通じて外部・追加通信が0件であること
    expect(postLoadRequests).toEqual([]);
    expect(postLoadFailedRequests).toEqual([]);
    expect(postLoadWebSockets).toEqual([]);
    expect(apiCalls).toEqual([]);
    expect(cspViolations).toEqual([]);
  });

  test('SEC-SEO-02: sessionStorageのみを使用し、Cookie・localStorage・IndexedDBへの永続保存が行われないこと', async ({
    page,
    context,
  }) => {
    let indexedDbOpenCount = 0;
    await page.exposeFunction('recordIndexedDbOpen', () => {
      indexedDbOpenCount += 1;
    });
    await page.addInitScript(() => {
      const origOpen = indexedDB.open.bind(indexedDB);
      indexedDB.open = function (...args: Parameters<typeof origOpen>) {
        (window as unknown as { recordIndexedDbOpen: () => void }).recordIndexedDbOpen();
        return origOpen(...args);
      };
    });

    await page.goto('/mask-unmask/');

    // 操作前のストレージ確認
    expect(await context.cookies()).toEqual([]);

    // 仮名化・カスタム追加・復元入力を実行
    await page.locator('#mask-input').fill('保存テスト: persist-check@example.org');
    await expect(page.locator('#mask-output')).toHaveValue('保存テスト: [CN_EMAIL_0001]');

    const storageSnapshot = await page.evaluate(async () => {
      const idbDatabases =
        typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
      return {
        cookie: document.cookie,
        localStorageKeys: Object.keys(window.localStorage),
        sessionStorageKeys: Object.keys(window.sessionStorage),
        sessionStateRaw: window.sessionStorage.getItem('cn_app_state'),
        idbCount: idbDatabases.length,
      };
    });

    expect(storageSnapshot.cookie).toBe('');
    expect(storageSnapshot.localStorageKeys).toEqual([]);
    expect(storageSnapshot.idbCount).toBe(0);
    expect(indexedDbOpenCount).toBe(0);
    expect(storageSnapshot.sessionStorageKeys).toEqual(['cn_app_state']);
    expect(storageSnapshot.sessionStateRaw).toContain('persist-check@example.org');
    expect(await context.cookies()).toEqual([]);

    // 同一タブ再読み込みで sessionStorage から復元されること
    await page.reload();
    await expect(page.locator('#mask-input')).toHaveValue('保存テスト: persist-check@example.org');
    await expect(page.locator('#mask-output')).toHaveValue('保存テスト: [CN_EMAIL_0001]');

    // 共通クリアで sessionStorage から消去されること
    await page.getByRole('button', { name: '共通クリア (リセット)' }).click();
    await page.getByRole('button', { name: 'クリア実行' }).click();

    const afterClearKeys = await page.evaluate(() => Object.keys(window.sessionStorage));
    expect(afterClearKeys).toEqual([]);
  });

  test('SEC-SEO-03: 入力テキストや置換マップの機密文字列がURL・title・meta・OGP・canonical・通信リクエストに混入しないこと', async ({
    page,
  }) => {
    const recordedUrls: string[] = [];
    page.on('request', (req) => {
      recordedUrls.push(req.url());
      const postData = req.postData();
      if (postData) {
        recordedUrls.push(postData);
      }
    });

    await page.goto('/mask-unmask/');

    const secretEmail = 'secret-leak-check-9911@example.org';
    const secretCustom = '極秘プロジェクトX_7788';
    const secretUnmaskNote = '機密メモ_5544';
    const secretImported = 'imported-secret-3322@example.org';
    const allSecrets = [
      secretEmail,
      secretCustom,
      secretUnmaskNote,
      secretImported,
      'secret-leak-check-9911',
      '7788',
      '5544',
      '3322',
    ];

    // 1. 仮名化入力・カスタム単語登録
    await page.locator('#mask-input').fill(`テスト入力 ${secretEmail} と ${secretCustom}`);
    await expect(page.locator('#mask-output')).toHaveValue(/\[CN_EMAIL_0001\]/);

    await page.locator('#custom-original').fill(secretCustom);
    await page.getByRole('button', { name: '登録を追加' }).click();
    await expect(page.locator('#mask-output')).toHaveValue(
      /\[CN_EMAIL_0001\].*\[CN_CUSTOM_0001\]/
    );

    // 2. JSONインポート
    const importPayload = JSON.stringify({
      version: '1.0',
      createdAt: '2026-11-02T00:00:00Z',
      mappings: [
        {
          tag: '[CN_EMAIL_0002]',
          original: secretImported,
          category: 'EMAIL',
        },
      ],
    });
    await page.locator('input[aria-label="マッピングファイルをインポート"]').setInputFiles({
      name: 'leak-check.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importPayload, 'utf8'),
    });
    await page.getByRole('button', { name: 'インポート確定' }).click();

    // 3. 復元入力
    await page.locator('#tab-unmask').click();
    await page
      .locator('#unmask-input')
      .fill(`${secretUnmaskNote}: [CN_EMAIL_0001] / [CN_CUSTOM_0001] / [CN_EMAIL_0002]`);
    await expect(page.locator('#unmask-output')).toContainText(secretEmail);

    const inspectHeadAndUrl = async () => {
      return page.evaluate(() => {
        const metaValues = [...document.querySelectorAll('meta')].map(
          (m) =>
            `${m.getAttribute('name') ?? m.getAttribute('property') ?? ''}=${
              m.getAttribute('content') ?? ''
            }`
        );
        const linkValues = [...document.querySelectorAll('link')].map(
          (l) => `${l.getAttribute('rel') ?? ''}=${l.getAttribute('href') ?? ''}`
        );
        const jsonLdValues = [
          ...document.querySelectorAll('script[type="application/ld+json"]'),
        ].map((s) => s.textContent ?? '');
        return {
          href: window.location.href,
          title: document.title,
          metaValues,
          linkValues,
          jsonLdValues,
        };
      });
    };

    const checkNoLeak = (snapshot: Awaited<ReturnType<typeof inspectHeadAndUrl>>) => {
      const combined = [
        snapshot.href,
        snapshot.title,
        ...snapshot.metaValues,
        ...snapshot.linkValues,
        ...snapshot.jsonLdValues,
        ...recordedUrls,
      ].join('\n');

      for (const secret of allSecrets) {
        expect(combined).not.toContain(secret);
      }
    };

    // ホーム画面での検査
    checkNoLeak(await inspectHeadAndUrl());

    // 安全性ページへ遷移した際の検査
    await page.locator('footer >> text=安全性とプライバシー').click();
    await expect(page).toHaveURL(/\/mask-unmask\/safety-and-privacy$/);
    checkNoLeak(await inspectHeadAndUrl());

    // ホーム画面へ戻った際の検査
    await page.getByRole('button', { name: 'ツールに戻る' }).click();
    await expect(page).toHaveURL(/\/mask-unmask\/$/);
    checkNoLeak(await inspectHeadAndUrl());

    // エクスポートJSONには既存仕様どおり平文の original が含まれ、注意ダイアログで平文である旨が明示されること
    await page.getByRole('button', { name: 'マップエクスポート' }).click();
    await expect(page.locator('#export-dialog-desc')).toContainText(
      'プレーンテキストとして含まれています'
    );
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '同意してエクスポート' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath) {
      const exportedJson = await readFile(downloadPath, 'utf8');
      expect(exportedJson).toContain(secretEmail);
      expect(exportedJson).toContain(secretCustom);
    }
  });

  test('SEC-SEO-04: SafetyPrivacyの説明・CSPヘッダー・法務リンク・実際の挙動に矛盾がないこと', async ({
    page,
    request,
  }) => {
    // 1. 配信レスポンスヘッダーのCSP確認
    const response = await request.get('/mask-unmask/');
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("connect-src 'none'");
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("script-src 'self'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');

    // 2. 安全性とプライバシー画面の説明内容と法務リンクの確認
    await page.goto('/mask-unmask/safety-and-privacy');

    await expect(page.getByRole('heading', { name: '安全性とプライバシーについて' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /1\. ブラウザ内での処理/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /2\. データの保存/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /3\. 通信と外部サービス/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /4\. エクスポートデータの注意/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /5\. 利用上の注意/ })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /6\. 提供元情報・利用規約・プライバシーポリシー/ })
    ).toBeVisible();

    const mainText = (await page.locator('main').textContent()) ?? '';
    expect(mainText).toContain('sessionStorage');
    expect(mainText).toContain('Cookie、localStorage、IndexedDB などの永続的な保存領域は使用していません');
    expect(mainText).toContain('外部アクセス解析ツール（Google Analytics等）は導入していません');
    expect(mainText).toContain('original 値として元の文字列が平文');
    expect(mainText).toContain('すべての機密情報を完全に検出できるとは限りません');

    // 法務リンク確認
    await expect(page.getByRole('link', { name: 'デジガーデン 公式サイト' })).toHaveAttribute(
      'href',
      'https://digi-garden.com/'
    );
    await expect(page.getByRole('link', { name: 'デジガーデン 利用規約' })).toHaveAttribute(
      'href',
      'https://digi-garden.com/terms/'
    );
    await expect(
      page.getByRole('link', { name: 'デジガーデン プライバシーポリシー' })
    ).toHaveAttribute('href', 'https://digi-garden.com/privacy/');
  });
});
