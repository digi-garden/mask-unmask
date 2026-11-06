# Mask & Unmask OSS・ライセンス監査記録（MU-COMP-005）

- 実施基準：digi-garden法務・ライセンス文書管理規約v1.1、`brand-assets`固定コミット `31bf40e921661c9c8e7b246434b349ad71c7c578`
- 対象：`digi-garden/mask-unmask`、初期監査基準の`main`コミット `b7244babaf225d98d7a14e4c0344a6207b50033e`
- 証跡：`package-lock.json`（npm lockfileVersion 3）、`package.json`、`scripts/finalize-build.mjs`
- 対象Web URL：`https://circle-note.com/mask-unmask/`
- 判定：**Partial / 完了保留**。依存メタデータ確認は実施済み。ライセンス本文・実配布物・表示義務充足は未検証。

## 自動監査コマンド

```bash
npm run audit:oss
npm run audit:oss -- --json > oss-manifest.json
```

`--json`は全依存のパッケージパス、バージョン、ライセンス識別子、開発用・optionalフラグを標準出力へ出す。リポジトリ内に勝手にファイルを生成しない。CIにも標準出力形式の監査を追加する。

自動監査は**lockfile上のメタデータの欠落を検知するための補助的検査**であり、ライセンスの法的適合を証明しない。実行時依存にライセンス識別子が欠けたらexit 1、開発用依存のみの欠落は警告（マージ許可とは無関係に追跡）。

## 初期観測（未修正のmain）

| 分類 | 件数・内容 |
|---|---|
| 全依存エントリ | 261 |
| `dev: true` 以外（実行時フラグ） | 5件。React 18.3.1、React DOM 18.3.1、scheduler 0.23.2、js-tokens 4.0.0、loose-envify 1.4.0。すべてlockfile表記はMIT |
| 開発用 `dev: true` | 256件 |
| ライセンス識別子なし | `parse-cache-control@1.0.1`（開発用）1件 |
| 特記事項 | `ffmpeg-static@5.3.0` はGPL-3.0-or-laterの開発用依存。Lightning CSS系はMPL-2.0の開発用依存。 `caniuse-lite`はCC-BY-4.0の開発用依存 |

**注意**：`dev`フラグは「配布に含まれない」証明ではない。Vite等のビルドツールが開発用依存のコードやアセットを出力に取り込む可能性を別途評価する。また`ffmpeg-static`がデモ動画生成のみに使われても、生成した動画を配布・公開する場合のライセンス・特許等の論点は別途確認する。

## 公開前に残る実査

1. `npm ci`した実際の依存パッケージについて、各`node_modules/<package>/package.json`、`LICENSE`、`NOTICE`等を確認し、lockfile記載のライセンスと矛盾しないか記録する。識別子が欠落した`parse-cache-control`は必ず原文を確認する。
2. `npm run build`で生成される`dist/`を調べ、含まれるJS/CSS、静的アセット、各ライセンスコメント／著作権表示、およびツール・フォント・動画由来の配布物を棚卸しする。開発用・実行時フラグだけで除外判断しない。
3. 実際に配布するOSSごとに**パッケージ名／厳密なバージョン／SPDX識別子／ライセンス本文の取得元／必要通知・同梱・ソース提供義務／満たす場所と証跡**を記録する。
4. 必要な通知を`dist/`に同梱するか、ページ・公開URL等に掲載するか決め、実際の配信をHTTPで検証する。`/licenses/`ページは一律の必須要件ではない。必要な場合だけ公開先を追加する。
5. 更新時には`npm run audit:oss -- --json`で差分を把握し、依存・配布物・表示義務を再評価する。
6. 結果を共通の製品リリース統合チェックリストのGate A（適用するOSS義務）へ反映する。**重大な未確認の法令・OSS義務をGate Bへ振り替えない**。

## 初期判定

**MU-COMP-005：未完了。** ロックファイルに基づく分類までは確認。ライセンス本文の正式な取得・再配布条件、出力物の組成、公開通知の要否を検証するまで適合宣言しない。

## 配布物・ライセンス原文の証跡採取（追加）

更新後のlockfileを基準に、ローカルで実際にインストールされた**runtimeフラグ付き**依存について、パッケージ直下のLICENSE/COPYING/NOTICE原文ファイルの有無とSHA-256を記録する。同時に本番ビルドの `dist/` 全ファイルのファイル名・バイト数・SHA-256を一覧化する。

```bash
npm ci
npm run build
npm run audit:distribution
npm run audit:distribution -- --json > distribution-evidence.json
```

`npm run audit:distribution` は証跡ファイルがないruntime依存をFAILにする。検証は読み取り専用で、`dist/`へのライセンス原文の追加やデプロイはしない。監査結果を保存する場合、ファイルハッシュとパッケージ名を記録する（個人情報や秘密情報を含めない）。

**証明範囲の限界**：各ハッシュは検査したローカルファイルの同一性だけを示す。開発時依存からの成果物混入、実際のバンドル内に含まれる著作物の由来、通知の法的義務、公開URLで配信されるファイルとの一致を保証しない。したがって本検査のPassだけでMU-COMP-005を完了扱いにしない。特に`parse-cache-control`のライセンス原文と、`ffmpeg-static`等の開発用依存に関する実配布への影響は別途確認する。
