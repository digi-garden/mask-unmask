# 法務文書導線の整備および共通利用規約（DG-02承認待ち）修正文案

本ドキュメントは、Mask & Unmask における法務文書導線の現状確認結果、承認不要で先行実装した表示・リンク改善内容、および公式サイト側の共通利用規約（DG-02）承認後に適用するための修正文案を記録したものです。

---

## 1. 現状の「安全性とプライバシー」ページおよびリンク検証結果

### 1.1. 現行ページの構成と記載確認（`src/components/SafetyPrivacy.tsx`）
- **パス**: `/mask-unmask/safety-and-privacy`
- **記載セクション**:
  1. ブラウザ内での処理（入力テキストや置換マップの外部送信なし）
  2. データの保存（`sessionStorage` による同一タブ内の一時保持、永続ストレージ不使用）
  3. 通信と外部サービス（アプリ起動後の外部通信なし、広告・解析・外部CDN不使用）
  4. エクスポートデータの注意（平文の `original` 値を含むJSONファイルの管理注意事項）
  5. 利用上の注意（自動検出の限界、目視確認、セキュリティ規程・関連法令の遵守、免責事項の整備予定に関する記載）
  6. 提供元情報とプライバシーポリシー（提供元「デジガーデン」およびプライバシーポリシーへの外部リンク）
- **現状の課題**:
  - 「5. 利用上の注意」の4項目目に「正式な免責事項（利用規約や免責規定等）は別途整備予定です。」という暫定文言が残っている。
  - 「6. 提供元情報とプライバシーポリシー」およびフッターに、デジガーデン共通利用規約（`https://digi-garden.com/terms/`）への参照・導線がまだ設けられていない（公式サイト側 DG-02 が承認待ちのため、現時点では未適用のまま維持する必要がある）。

### 1.2. デジガーデン外部法務ページへのリンク検証結果
以下の公式URLについて、HTTPレスポンスおよび公開内容を確認しました（検証日: 2026-10-26）。

| 対象ページ | URL | HTTPステータス | 検証結果・備考 |
| :--- | :--- | :--- | :--- |
| デジガーデン 公式サイト | `https://digi-garden.com/` | `200 OK` | 正常に応答。フッターおよび「提供」ロゴのリンク先。 |
| プライバシーポリシー | `https://digi-garden.com/privacy/` | `200 OK` | 正常に応答。「現行製品の補足」に Mask & Unmask（ブラウザ内処理・外部送信なし）の記載あり。 |
| 共通利用規約 | `https://digi-garden.com/terms/` | `200 OK` | ページ自体は応答するが、公式サイト側 **DG-02（共通利用規約の適用・改定）が承認待ち** のため、本リポジトリでの規約適用文言への変更およびリンク公開は保留とする。 |

---

## 2. 今回実装した変更（承認を必要としない表示・リンク改善）

公式サイト側 DG-02 の承認を待たずに実施可能な、既存仕様・承認済み範囲内の法務導線改善のみを実装しました。

1. **共通フッター（`src/App.tsx`）の導線改善**:
   - 既存の「提供：digi-garden（ロゴ）」「安全性とプライバシー（アプリ内SPA遷移）」に加え、承認済みの「プライバシーポリシー（`https://digi-garden.com/privacy/`）」への直接リンク（`target="_blank" rel="noopener noreferrer"`）をフッターに併設しました。
2. **「安全性とプライバシー」ページ（`src/components/SafetyPrivacy.tsx`）の表示・リンク改善**:
   - 「6. 提供元情報とプライバシーポリシー」セクションに、既存の「デジガーデン プライバシーポリシー（`https://digi-garden.com/privacy/`）」リンクと並べて、「デジガーデン 公式サイト（`https://digi-garden.com/`）」へのテキストリンク（`target="_blank" rel="noopener noreferrer"`）を追加し、提供元情報へのアクセス性を向上させました。
   - 「5. 利用上の注意」における「正式な免責事項（利用規約や免責規定等）は別途整備予定です。」の記載は、未承認の規約適用変更を行わない方針に従い、現行のまま維持しています。
3. **既存仕様の維持**:
   - 仮名化処理（`maskEngine.ts`）、置換マップ管理（`mapFileService.ts` / `validator.ts`）、データ保存仕様（`usePersistedState.ts` の `sessionStorage` 仕様）は一切変更していません。

---

## 3. 【承認待ち】DG-02 承認後に適用する修正文案

公式サイト側の **DG-02（デジガーデン共通利用規約の適用承認）** が完了した際、以下の文案およびコード差分を適用してください。

### 3.1. `src/components/SafetyPrivacy.tsx` の修正文案

#### (A) セクション5「5. 利用上の注意」4項目目の差し替え文案

- **変更前（現行）**:
  ```text
  本ページは本ツールの技術的な処理とデータの扱いを説明するものであり、正式な免責事項（利用規約や免責規定等）は別途整備予定です。
  ```
- **変更後（DG-02承認後・修正文案）**:
  ```text
  本ページは本ツールの技術的な処理とデータの扱いを説明するものです。本ツールの利用条件および免責事項等については、デジガーデン共通の「利用規約」が適用されます。
  ```

#### (B) セクション6の見出しおよび本文・リンクの差し替え文案

- **変更前（現行）**:
  - 見出し：`6. 提供元情報とプライバシーポリシー`
  - 本文：`本ツールは「デジガーデン」によって開発・提供されています。提供元のWebサイトおよび個人情報保護方針につきましては、以下のリンクよりご確認ください。`
  - リンク：`デジガーデン 公式サイト` / `デジガーデン プライバシーポリシー`
- **変更後（DG-02承認後・修正文案）**:
  - 見出し：`6. 提供元情報・利用規約・プライバシーポリシー`
  - 本文：`本ツールは「デジガーデン」によって開発・提供されています。本ツールの利用条件（利用規約）および個人情報保護方針（プライバシーポリシー）につきましては、以下のリンクよりご確認ください。`
  - リンク：
    - `デジガーデン 公式サイト`（`https://digi-garden.com/`）
    - `デジガーデン 利用規約`（`https://digi-garden.com/terms/`）
    - `デジガーデン プライバシーポリシー`（`https://digi-garden.com/privacy/`）

#### (C) `src/components/SafetyPrivacy.tsx` 実装用コードスニペット（DG-02承認後）

```tsx
        {/* 5. 利用上の注意 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-brand-primary flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            5. 利用上の注意
          </h3>
          <div className="text-sm text-slate-300 space-y-2 leading-relaxed pl-7">
            <ul className="list-disc list-inside space-y-1">
              <li>自動検出機能は特定のパターン（正規表現等）にマッチする情報を機械的に検出するものであり、すべての機密情報を完全に検出できるとは限りません。</li>
              <li>変換結果に機密情報が残っていないか、最終的には必ず利用者自身で目視確認してください。</li>
              <li>所属する企業・団体のセキュリティ規程、および適用される個人情報保護法等の関連法令に従ってご利用ください。</li>
              <li>本ページは本ツールの技術的な処理とデータの扱いを説明するものです。本ツールの利用条件および免責事項等については、デジガーデン共通の「利用規約」が適用されます。</li>
            </ul>
          </div>
        </section>

        {/* 6. 提供元情報・利用規約・プライバシーポリシー */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-brand-primary flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            6. 提供元情報・利用規約・プライバシーポリシー
          </h3>
          <div className="text-sm text-slate-300 space-y-2 leading-relaxed pl-7">
            <p>
              本ツールは「デジガーデン」によって開発・提供されています。本ツールの利用条件（利用規約）および個人情報保護方針（プライバシーポリシー）につきましては、以下のリンクよりご確認ください。
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
              <a
                href="https://digi-garden.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-primary underline hover:text-brand-primaryHover transition"
              >
                <span>デジガーデン 公式サイト</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <a
                href="https://digi-garden.com/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-primary underline hover:text-brand-primaryHover transition"
              >
                <span>デジガーデン 利用規約</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <a
                href="https://digi-garden.com/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-primary underline hover:text-brand-primaryHover transition"
              >
                <span>デジガーデン プライバシーポリシー</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </section>
```

---

### 3.2. `src/App.tsx`（フッター）の修正文案（DG-02承認後）

DG-02承認後は、フッターにも「利用規約（`https://digi-garden.com/terms/`）」リンクを追加します。

```tsx
          <span className="text-slate-700">|</span>
          <a
            href="https://digi-garden.com/terms/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
          >
            利用規約
          </a>
          <span className="text-slate-700">|</span>
          <a
            href="https://digi-garden.com/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
          >
            プライバシーポリシー
          </a>
```
