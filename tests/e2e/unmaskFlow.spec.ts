import { test, expect } from '@playwright/test';

test.describe('Mask & Unmask E2E Flow', () => {

  test('Mask ➔ Unmask 全体フローが正常に機能し、正しく仮名化および復元が行われること (指摘26-1)', async ({ page }) => {
    await page.goto('/mask-unmask/');
    await expect(page).toHaveTitle('Mask & Unmask | digi-garden');

    // 画面UI表示項目の検証
    const headerTitle = page.locator('header h1');
    await expect(headerTitle).toHaveText('Mask & Unmask');
    const headerDesc = page.locator('header p >> text=機密情報の仮名化・復元ツール');
    await expect(headerDesc).toBeVisible();

    await expect(page.locator('footer > p').first())
      .toHaveText('© 2026 digi-garden');

    // 旧製品名 CircleNote が画面テキスト(ドメイン除く)に漏れ出ていないことを検証
    const bodyText = await page.textContent('body');
    const hasOldProductName = /CircleNote(?!\.com)/i.test(bodyText || '');
    expect(hasOldProductName).toBe(false);

    // 1. 仮名化入力テキストエリアへ文字を入力
    const maskInput = page.locator('#mask-input');
    await maskInput.fill('接続元 1.1.1.1、メール john@example.com です。');

    // 500ms debounce を考慮して少し待つ、または出力が更新されるまで待機
    const maskOutput = page.locator('#mask-output');
    await expect(maskOutput).toHaveValue(/\[CN_IPV4_0001\].*\[CN_EMAIL_0001\]/);

    // 2. 置換マップ一覧が表示されていることの検証 (表示中テーブル要素を明示指定して非表示カード回避)
    await expect(page.locator('#panel-mask table >> text=john@example.com')).toBeVisible();
    await expect(page.locator('#panel-mask table >> text=1.1.1.1')).toBeVisible();

    // 3. コピーボタンが機能すること (表示中パネルを明示指定)
    const copyBtn = page.locator('#panel-mask button:has-text("コピー (Copy)")');
    await expect(copyBtn).toBeEnabled();
    await copyBtn.click();

    // 4. 元データ復元 (Unmask) タブへ遷移
    const unmaskTabBtn = page.locator('#tab-unmask');
    await unmaskTabBtn.click();

    // 復元パネルが表示されていること
    await expect(page.locator('#panel-unmask')).toBeVisible();

    // 5. 復元元入力テキストエリアに仮名化タグを含んだ文章を入力
    const unmaskInput = page.locator('#unmask-input');
    await unmaskInput.fill('ログイン [CN_EMAIL_0001] via [CN_IPV4_0001]');

    // 復元結果が更新されるまで待機
    const unmaskOutput = page.locator('#unmask-output');
    await expect(unmaskOutput).toHaveValue('ログイン john@example.com via 1.1.1.1');

    // サマリーパネルの件数が「2 件」であること
    await expect(page.locator('#panel-unmask >> text=2 件')).toBeVisible();
  });

  test('画面幅縮小時に、モバイル専用レスポンシブデザインへ切り替わること (指摘26-2 & 指摘3)', async ({ page }) => {
    await page.goto('/mask-unmask/');

    // モバイルのビューポート (375x667) に設定
    await page.setViewportSize({ width: 375, height: 667 });

    // PC専用のカスタム単語登録フォームが非表示であること
    const customRegisterForm = page.locator('text=カスタム単語登録');
    await expect(customRegisterForm).not.toBeVisible();

    // 置換マップ一覧はモバイルでも表示されていること
    const mappingsList = page.locator('text=置換マップ一覧');
    await expect(mappingsList).toBeVisible();

    // 共通クリアボタンが横幅いっぱい (w-full) になっていること
    const clearBtn = page.locator('button:has-text("共通クリア (リセット)")');
    const classes = await clearBtn.getAttribute('class');
    expect(classes).toContain('w-full');

    // 実際にほぼ親コンテナいっぱいに描画されていることを boundingBox を用いてアサート (指摘3 & 指摘6)
    const buttonBox = await clearBtn.boundingBox();
    const mainBox = await page.locator('main').boundingBox();

    expect(buttonBox).not.toBeNull();
    expect(mainBox).not.toBeNull();

    if (buttonBox && mainBox) {
      // 左右パディングがあるため、90%以上の横幅割合を占めていることをアサート
      expect(buttonBox.width).toBeGreaterThanOrEqual(mainBox.width * 0.9);
    }
  });

  test('connect-src "none" により外部への fetch リクエストがブラウザレイヤーで遮断され、CSP違反イベントが発生すること (指摘26-3 & 指摘1)', async ({ page }) => {
    // 1. ページロード前に securitypolicyviolation イベントリスナーを確実に登録 (InitScriptを使用)
    const violations: any[] = [];
    await page.exposeFunction('logViolation', (violation: any) => {
      violations.push(violation);
    });

    await page.addInitScript(() => {
      window.addEventListener('securitypolicyviolation', (e) => {
        (window as any).logViolation({
          violatedDirective: e.violatedDirective,
          blockedURI: e.blockedURI
        });
      });
    });

    await page.goto('/mask-unmask/');

    // 2. 外部への fetch 実行 (CSPにより遮断される)
    await page.evaluate(async () => {
      try {
        await fetch('https://example.com');
      } catch (e) {
        // ignore error
      }
    });

    // 3. 実際に connect-src 'none' の CSP 違反イベントが発生していることを検証
    // 固定スリープを排除し、非同期のイベント登録をポーリングで待機 (指摘3)
    await expect.poll(() =>
      violations.find(v =>
        v.violatedDirective === 'connect-src' &&
        v.blockedURI.includes('https://example.com')
      )
    ).toBeTruthy();
  });

  test('「安全性とプライバシー」ページへのSPA遷移、アプリへの復帰、および直接アクセスが動作すること', async ({ page }) => {
    // 1. トップページから遷移
    await page.goto('/mask-unmask/');
    const privacyLink = page.locator('footer >> text=安全性とプライバシー');
    await expect(privacyLink).toBeVisible();
    await privacyLink.click();

    // 2. 安全性とプライバシーページの表示確認
    await expect(page).toHaveURL(/\/mask-unmask\/safety-and-privacy$/);
    const heading = page.locator('text=安全性とプライバシーについて');
    await expect(heading).toBeVisible();

    // 3. アプリへの復帰確認 (ツールに戻るボタン)
    const backBtn = page.locator('button:has-text("ツールに戻る")');
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL(/\/mask-unmask\/$/);
    await expect(page.locator('#tab-mask')).toBeVisible();

    // 4. アプリから案内リンクでの遷移
    const labelNoticeLink = page.locator('#panel-mask a:has-text("安全性とプライバシーについて詳しく見る")');
    await expect(labelNoticeLink).toBeVisible();
    await labelNoticeLink.click();
    await expect(page).toHaveURL(/\/mask-unmask\/safety-and-privacy$/);

    // 5. ヘッダーロゴをクリックしてアプリに戻る
    const headerLogo = page.locator('header a >> text=Mask & Unmask');
    await expect(headerLogo).toBeVisible();
    await headerLogo.click();
    await expect(page).toHaveURL(/\/mask-unmask\/$/);

    // 6. 直接アクセスの確認
    await page.goto('/mask-unmask/safety-and-privacy');
    await expect(page.locator('text=安全性とプライバシーについて')).toBeVisible();

    // 7. 直接アクセス時の再読み込みの確認
    await page.reload();
    await expect(page.locator('text=安全性とプライバシーについて')).toBeVisible();

    // 8. 末尾スラッシュ付きURLでのアクセス確認 (正規化され、安全性ページが表示されること)
    await page.goto('/mask-unmask/safety-and-privacy/');
    await expect(page).toHaveURL(/\/mask-unmask\/safety-and-privacy$/);
    await expect(page.locator('text=安全性とプライバシーについて')).toBeVisible();

    // 9. 不明なパスへの直接アクセス時の自動トップ画面フォールバック確認
    await page.goto('/mask-unmask/unknown-random-path');
    await expect(page).toHaveURL(/\/mask-unmask\/$/);
    await expect(page.locator('#tab-mask')).toBeVisible();

    // 10. ブラウザの戻る・進む動作の確認
    await page.goto('/mask-unmask/');
    const footerLink = page.locator('footer >> text=安全性とプライバシー');
    await footerLink.click();
    await expect(page).toHaveURL(/\/mask-unmask\/safety-and-privacy$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/mask-unmask\/$/);
    await expect(page.locator('#tab-mask')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/mask-unmask\/safety-and-privacy$/);
    await expect(page.locator('text=安全性とプライバシーについて')).toBeVisible();
  });

  test('CircleNoteトップからアプリへ移動できること', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('CircleNote');
    await expect(page.getByRole('heading', { name: 'CircleNote', exact: true })).toBeVisible();

    const appLink = page.getByRole('link', { name: /Mask & Unmaskを開く/ });
    await expect(appLink).toHaveAttribute('href', '/mask-unmask/');
    await appLink.click();
    await expect(page).toHaveURL(/\/mask-unmask\/$/);
    await expect(page.locator('header h1')).toHaveText('Mask & Unmask');
  });

  test('/mask-unmask を末尾スラッシュ付き正式URLへ301リダイレクトすること', async ({ request, page }) => {
    const response = await request.get('/mask-unmask', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe('/mask-unmask/');

    await page.goto('/mask-unmask');
    await expect(page).toHaveURL(/\/mask-unmask\/$/);
    await expect(page.locator('#tab-mask')).toBeVisible();
  });

});
