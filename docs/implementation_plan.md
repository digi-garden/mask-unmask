# 実装計画書：Mask & Unmask (MVP)

本計画書は、確定した要件定義書および基本設計書に基づき、Vite + React + TypeScript プロジェクトのセットアップからコアエンジン実装、UI構築、および動作検証までの具体的な開発ステップを定義します。

---

## 1. プロジェクト初期セットアップ & 静的配信構成
外部通信のリスクを排除した静的フロントエンド環境を構築します。

#### [NEW] [package.json](../package.json)
* プロジェクトの依存関係を管理。React、TypeScript、Tailwind CSS、およびテスト用ライブラリ（Vitest, React Testing Library, Playwright）を追加。
* システム等幅フォント（`ui-monospace` など）のみに限定し、外部フォントファイルのローカル同梱を排除してパフォーマンスと通信リスクを低減。
* 静的解析およびテストコマンドを定義:
  * `npm run test` (ユニットテスト)
  * `npm run test:perf` (自動性能テスト)
  * `npm run test:e2e` (E2Eテスト)
  * `npm run type-check` (型チェック: `tsc --noEmit`)
  * `npm run build` (本番ビルド)

#### [NEW] [vite.config.ts](../vite.config.ts)
* ビルド設定、エイリアス設定。静的配信用のメタデータ出力を構成。

#### [NEW] [public/_headers](../public/_headers)
* Cloudflare Pages の HTTP レスポンスヘッダー定義。
* 確定したCSP（`connect-src 'none'`, `base-uri 'none'` 等）およびセキュリティヘッダー（`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`）を記述。ビルド時に `dist/_headers` へそのままコピーされるようにします。

#### [NEW] [src/index.css](../src/index.css)
* Tailwind CSS の読み込みと、等幅フォントやダークモード（Slate/Zinc背景、#10B981 エメラルドグリーン）の共通デザインシステム・トークンを記述。

---

## 2. コアロジック (仮名化・復元エンジン & バリデータ)

#### [NEW] [src/utils/maskEngine.ts](../src/utils/maskEngine.ts)
* **主な実装内容:**
  * タグ抽出用の共通正規表現を安全に（`lastIndex` を意識せず）生成する `createTagRegex()` 関数の実装。
  * 自動検出用の各カテゴリ（APIKEY, IPV4, IPV6, EMAIL, PHONE）の正規表現の定義。
  * 既存タグ形式の事前検出および警告フラグ生成ロジック。
  * **一括競合解決処理:** ソース優先（CUSTOM/IMPORT ➔ AUTO） ➔ 最長一致優先 ➔ カテゴリ優先 ➔ 開始位置 `start` 優先 ➔ タグ名辞書順の決定性タイブレークロジックの実装。
  * **Maskスライシング再構築:** 競合解決された非重複マッチリストを開始位置の昇順でソートし、非置換領域と置換タグを連結するアルゴリズム。
  * **Unmaskスライシング再構築:** 復元された元の値の中に他のタグが含まれていた場合の二重置換（データ破損）を防ぐため、最初の入力から抽出したタグ候補に基づき位置（インデックス）ベースで一度だけテキスト出力を再構築するアルゴリズム。
  * **モバイル時のUnmask制限:** UI上でカスタム/インポート機能のみを隠し、復元エンジンはPC/モバイル共通とする（画面幅変更時のデータ不整合を防ぐための要件確定）。

#### [NEW] [src/utils/validator.ts](../src/utils/validator.ts)
* **主な実装内容:**
  * インポートされたJSONデータに対し、軽量なカスタムバリデータロジックを実装し、JSON Schemaのすべての制約（`const`, `format: date-time`, タグの `pattern`, `minLength`, `maxLength`, `enum`, 未知フィールドを却下する `additionalProperties: false`, `maxItems: 1000` など）を網羅的に検証。
  * タグのプレフィックスと `category` プロパティの完全一致チェック。

#### [NEW] [src/utils/mapFileService.ts](../src/utils/mapFileService.ts)
* **ファイルI/Oの分離:**
  * 500KB制限の読み込み前チェック（`file.size` の検査）。
  * `FileReader.readAsText` による UTF-8 デコードおよび JSON 解析。
  * `version` および `createdAt` を含む JSON オブジェクトの生成（エクスポート用）。エクスポートデータからは `source` プロパティを除外する。
  * Blob URL の生成と、ダウンロード実行後の `URL.revokeObjectURL()` によるメモリ解放処理。
  * プレビュー確定前は React State に一切触れずメモリ上だけで検証し、ユーザー確定時に一括適用するトランザクション的インポート・キャンセル処理。

---

## 3. 状態管理 & 永続化

#### [NEW] [src/hooks/usePersistedState.ts](../src/hooks/usePersistedState.ts)
* **主な実装内容:**
  * 単一のアプリ状態オブジェクト `PersistedAppState` による React State と `sessionStorage` の一括読み書き。
  * `sessionStorage` への書き込み時の `try-catch` 処理（`QuotaExceededError` 発生時は React State を変更せずロールバックし、エラーメッセージを発生させる）。
  * ロード時の `version: 1` チェックおよび構造破損・型違い時のセッション完全クリア処理。

---

## 4. UIコンポーネント (React)

#### [NEW] [src/components/TabContainer.tsx](../src/components/TabContainer.tsx)
* `role="tablist"`, `role="tab"`, `role="tabpanel"` によるWAI-ARIA準拠のタブ切り替え。左右矢印キーによるフォーカス遷移。

#### [NEW] [src/components/MaskTab.tsx](../src/components/MaskTab.tsx)
* テキストエリア入力（500ms debounceによるMaskエンジン実行）、自動検出トグル、カスタム単語登録サイドバー（PC専用：768px以上で表示）、仮名化出力とコピーボタン（コピー失敗時の全選択フォールバック対応）、置換マップ一覧と個別削除（一時除外リスト管理）。

#### [NEW] [src/components/UnmaskTab.tsx](../src/components/UnmaskTab.tsx)
* AI回答コピペ入力エリア、復元結果出力、復元成功件数および未復元タグ一覧のステータス表示。

#### [NEW] [src/components/CommonActions.tsx](../src/components/CommonActions.tsx)
* タブエリア外の共通操作パネル。一括クリア（リセット）ボタン（確認ダイアログ付き、全デバイス表示）。インポート・エクスポートボタン（警告表示付き、インポート前プレビュー確認ダイアログ連携、PCのみ表示）。

#### [NEW] [src/App.tsx](../src/App.tsx)
* 全体レイアウトの構築、トースト通知およびモーダルダイアログの表示制御。

---

## Verification Plan

### 1. Automated Tests (自動テスト)

#### ユニットテスト (Vitest)
* **実行コマンド:** `npm run test`
* **主なテスト対象:**
  * `maskEngine.test.ts`:
    * 自動検出の正規表現（APIKEY、IPV4、IPV6、EMAIL、PHONE）が受け入れ条件に合致すること。
    * 一括競合解決の優先順位がタイブレーク含めて決定的に動作すること。
    * 既存タグ形式入力時にMaskを中断すること。
    * 表記揺れの標準化と、位置ベース Unmask の二重復元防止が期待通りに動作すること。
  * `validator.test.ts` & `mapFileService.test.ts`:
    * JSON Schema検証（additionalProperties, maxItems等）およびタグとカテゴリの一致検証が動作すること。
    * 競合マージのリナンバリングや重複排除が正しく行われること。
    * インポート時の例外（JSON破損、型エラーなど）でロールバックされ、既存の状態が維持されること。
  * 状態ライフサイクルテスト:
    * トグルOFF、入力から消えた場合の `source: "AUTO"` マップアイテムの削除。
    * `source: "CUSTOM"` / `"IMPORT"` の保持。
    * 個別削除後に除外リストへ登録され、入力変更まで再検出されないこと、および入力変更時の除外クリア。
    * 連番が `9999` に達した際の上限エラー。
    * 壊れた/旧バージョンデータの検知と初期化。
    * 状態管理フック（usePersistedState）のテストにおいて、`sessionStorage` への書き込み時に `QuotaExceededError` が発生した際、React State を変更せず以前の状態を維持することの検証。

#### コンポーネントテスト (React Testing Library)
* **検証内容:**
  * タブの WAI-ARIA 属性と左右矢印キーによるアクティブ制御。
  * コピー失敗時の全選択フォールバック。
  * リセット確認およびインポートプレビューのモーダル挙動。
  * トースト通知とモーダルダイアログのアクセシビリティフォーカス管理。

#### E2Eテスト (Playwright)
* **実行コマンド:** `npm run test:e2e`
* **検証内容:**
  * ブラウザの実環境において、Mask ➔ コピー ➔ Unmask ➔ 復元 の一連のフローが正常に完了すること。
  * 768px未満の画面幅において、PC専用UI（インポート・エクスポート、カスタム登録）が非表示になり、リセットボタンが全幅で表示されること。

#### 性能テスト (Vitest / 性能試験)
* **実行コマンド:** `npm run test:perf`
* **検証内容:**
  * 100KB固定テストデータ（各種パターン多数埋め込み）を用い、10回のウォームアップ後、100回連続でMask処理を実行。
  * 測定された時間の昇順ソートからp95の所要時間（95パーセンタイル）を算出。基準環境（ローカル開発PC等）において50ms以下であることを自動アサーションで判定する。不特定のCI環境下ではハードウェア性能による揺らぎがあるため、厳密なアサーションによる強制エラーは行わず、計測値の出力および回帰監視用として測定を実行する。

---

### 2. Manual Verification (手動検証)
本番ビルドされた静的アセットを用いて、実環境での検証を行います。

* **型チェック & ビルド検証:**
  ```bash
  npm run type-check && npm run build
  ```
  型エラーがなくビルドが成功すること、および成果物 `dist/` ディレクトリ内に `_headers` が正しく出力されていることを確認。
* **外部通信の検証:**
  * アプリ起動後、入力・変換・コピー・インポート・エクスポート等を操作し、DevToolsの Network タブにおいて追加の通信（HTTPリクエスト等）が一切発生しないことを確認する。
* **アクセシビリティ & コントラスト比検証:**
  * Lighthouse を用いて、Accessibility スコアおよび FCP (Fast 3Gで1.5秒以下)、LCP (2.0秒以下) を測定。
  * UI のテキストコントラスト比が WCAG 2.1 Level AA 基準（4.5:1以上）を満たしていることを確認。
