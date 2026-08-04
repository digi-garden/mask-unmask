# Lighthouse & CSP セキュリティ品質監査レポート

本ドキュメントは、本ツールの実装フェーズ3におけるアクセシビリティ（Lighthouse実測基準）、コントラスト比、パフォーマンス（実測値）およびセキュリティポリシー（CSP）の実機ヘッダー送出・動作検証結果をまとめた監査レポートです。

---

## 1. セキュリティ (CSP) の実機動作検証

### 1.1. HTTP レスポンスヘッダーの取得確認
本番同等の Vite preview サーバー（ポート `4173`）をローカルで起動し、cURL による HTTP レスポンスヘッダーの送出状況を確認しました。

**cURL 実行コマンド:**
```bash
curl -I http://localhost:4173/
```

**取得したレスポンスヘッダー:**
```http
HTTP/1.1 200 OK
Vary: Origin
Content-Type: text/html
Cache-Control: no-cache
Etag: W/"199-Gng071tdD9nt1Sl2lBrJ8At911A"
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Connection: keep-alive
Keep-Alive: timeout=5
```

### 1.2. CSP 各ディレクティブの動作実証 (E2Eテストでの検証結果)
Playwright E2E テストスイート内で、実際のブラウザ実行コンテキストを用いたセキュリティ動作の検証を行いました。

* **`connect-src 'none'` (ブラウザレイヤー遮断の検証完了):**
  ブラウザの W3C CSP セキュリティ仕様に基づき、JavaScript 側からの外部（`https://example.com`）への `fetch()` 実行がブラウザによって強制遮断され、それに伴う `securitypolicyviolation` イベント（CSP違反イベント）が正しく発生することを Playwright E2E テスト (`tests/e2e/unmaskFlow.spec.ts`) で実証・合格しました。
  テスト内では、イベントの `violatedDirective` が `connect-src` であること、および `blockedURI` が指定した `https://example.com` であることをアサートしてパスしています。
* **`base-uri 'none'` (送出確認済み):**
  DOM 内に `<base>` タグを動的挿入して相対パスの解決先を悪意ある外部ドメインへ書き換える攻撃を、ブラウザレイヤーで無効化する設定が適用されています。
* **`X-Content-Type-Options: nosniff` (送出確認済み):**
  リソースの MIME タイプが一致しない場合にスクリプトとしての実行を防ぎ、スニッフィング攻撃を防止します。
* **`Referrer-Policy: no-referrer` (送出確認済み):**
  外部遷移時などのリファラーヘッダー送信を遮断し、パス情報に含まれる機密文字列の漏洩リスクを防止します。

---

## 2. Lighthouse 品質監査 (実機測定結果)

本番同等ビルドに対して、Lighthouse CLI を用いて実測したスコアおよびパフォーマンス指標です。

### 2.1. 測定メタデータと再現環境
第三者によるスコアの再検証・再現性を確保するため、測定時のメタデータおよび環境情報を以下に公開します。
* **測定日時:** `2026-08-01 14:17:29 (UTC)`
* **実行環境:** `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36`
* **CPU 性能インデックス (Benchmark Index):** `3772`
* **Lighthouse バージョン:** `12.8.2`
* **再現・実行コマンド (Lighthouseバージョン固定):**
  ```bash
  # CHROME_PATH には検証対象環境の Chrome バイナリの絶対パスを指定してください
  CHROME_PATH=/path/to/chrome npx -y lighthouse@12.8.2 http://localhost:4173/ --chrome-flags="--headless --no-sandbox" --output=json --output-path=./docs/lighthouse-report.json --no-enable-error-reporting
  ```
  > [!NOTE]
  > 必要に応じて上記のコマンドを実行することで、JSON形式の監査レポートを再生成することができます。ただし、生成されたレポートファイルには、測定対象のURL、実行環境情報、およびその時点の画面UIに描画されていた古い表示内容などが含まれる可能性があります。外部に共有・公開する際は、事前に内容を確認し、不要な情報の漏洩がないことを監査してください。

### 2.2. 測定スコア要約
* **Performance (パフォーマンス):** `100` / 100
* **Accessibility (アクセシビリティ):** `94` / 100
* **Best Practices (ベストプラクティス):** `100` / 100
* **SEO:** `82` / 100

### 2.3. パフォーマンス主要指標 (Metrics)
* **FCP (First Contentful Paint):** `1.3 秒` (要件である1.5秒以下を達成)
* **LCP (Largest Contentful Paint):** `1.3 秒` (要件である2.0秒以下を達成)
* **TBT (Total Blocking Time):** `0 ms` を観測

---

## 3. アクセシビリティおよびマークアップ評価と減点分析

### 3.1. 減点対象となった監査項目 (Accessibility: 94点 の要因)
Lighthouse レポートから抽出された、減点対象（スコア未達成）の監査項目および要素の詳細は以下の通りです。

#### ① `color-contrast` (背景色と文字色のコントラスト比不足) - スコア: `0`
* **指摘対象 1:** 置換マップ一覧の空時メッセージ
  * **HTML要素:** `<div class="p-8 text-center text-slate-500 text-sm">` (テキスト内容: "現在、仮名化されたデータはありません")
  * **詳細情報:** 文字色 `#64748b` (slate-500) と背景色 `#0e1527` (slate-950相当) のコントラスト比は **`3.81:1`** であり、WCAG AA基準である **`4.5:1`** に満たないため指摘されました。
* **指摘対象 2:** 共通クリア（リセット）ボタン
  * **HTML要素:** `<button class="w-full ... bg-brand-danger/10 text-brand-danger">` (テキスト内容: "共通クリア (リセット)")
  * **詳細情報:** 文字色 `#ef4444` (red-500相当) と背景色 `#251c2d` (クリア時の危険色ブレンド背景) のコントラスト比は **`4.35:1`** であり、WCAG AA基準である **`4.5:1`** に満たないため指摘されました。
* **指摘対象 3:** フッター
  * **HTML要素:** `<footer class="border-t ... text-slate-500 text-xs">` (テキスト内容: "© 2026 digi-garden")
  * **詳細情報:** 文字色 `#64748b` (slate-500) と背景色 `#0f172a` (slate-900) のコントラスト比は **`3.75:1`** であり、WCAG AA基準である **`4.5:1`** に満たないため指摘されました。

#### ② `heading-order` (見出し階層順序の不整合) - スコア: `0`
* **指摘対象:**
  * **HTML要素:** `<h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">` (テキスト内容: "自動検出カテゴリー")
  * **詳細情報:** `<h1>` (アプリケーションヘッダー) の直後に `<h2>` を介さずに `<h3>` が配置されているため、階層順序（降順）の不整合として指摘されました。

---

### 3.2. 適合した主要なアクセシビリティ設計
減点対象外となった W3C 及び Lighthouse アクセシビリティ基準の主要な適合設計は以下の通りです。

* **WAI-ARIA タブ操作の完全実装:**
  * タブリストコンテナに `role="tablist"` を付与。
  * 各タブ切り替えボタンに `role="tab"`, `aria-selected="true/false"`, `tabindex="0/-1"` を動的付与。
  * 左右矢印キーによるフォーカス移動、および Enter/Space キーによるタブ選択に対応。
  * タブパネルには `role="tabpanel"`, `aria-labelledby` に対応するタブ ID を設定し、非アクティブ時は `hidden` と `className="hidden"` を連動制御。
* **トグルのキーボードフォーカス設計:**
  * 自動検出トグルの実 checkbox に対して `sr-only` を適用し、視覚的には非表示にしつつ、Tab キーによるフォーカス移動とキーボードスペースキーによるチェック状態のトグル操作を可能に設計。
* **タッチ領域の確保 (モバイルサイズ):**
  * 置換マップ一覧の削除ボタン（✕）は、モバイルカードおよびPCテーブル共に、タッチターゲット最小ガイドラインである **`w-12 h-12` (48x48px)** を確保。
