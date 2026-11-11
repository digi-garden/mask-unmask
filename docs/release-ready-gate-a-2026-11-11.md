# Mask & Unmask — Gate A最終審査／公開承認用記録

**適用規約**: digi-garden/brand-assets `31bf40e921661c9c8e7b246434b349ad71c7c578` の `templates/release/product-release-checklist.md`。本書は新しいゲートを作らず、既存のGate A/A1・A3・A5の不足を確認する。

**対象**: `digi-garden/mask-unmask` の `integration/mu-compliance-acceptance` を `main` にマージして配布するリリース候補。現行本番は別コミットであり、本書の作業中に`main`へマージしない。

## A3：データ損失の重大な既知問題 — PASS

製品オーナーは2026-11-11（JST）に **「既知の重大なデータ損失の問題はない」** と明示表明した。

主要な保存処理・復元・仮名化ロジックについて、`main` と統合ブランチの Git blob SHA は同一：

| ファイル | Git blob SHA |
|---|---|
| `src/hooks/usePersistedState.ts` | `bffb177760857b331275956879692fbac09e2ce3` |
| `src/utils/maskEngine.ts` | `b89a6c8b780df4a43c4372b7c523d5643ceec730` |
| `src/components/UnmaskTab.tsx` | `c269c058c26bee9272f0ffea97fc7f13b330b68d` |

GitHubの対象リポジトリで `is:issue is:open` も照会し、未解決Issueは0件（確認時点）。上記の同一性と既存CI/E2E、オーナーによる明示表明を根拠にA3をPASS。将来の障害ゼロを保証するものではない。

## A5：秘密情報混入／本番依存の重大脆弱性 — PASS（確認済みCIコミットに限定）

既存のCI品質ジョブに以下の2検査を追加。**新しい独立リリースゲートではない**。

- `npm run audit:production-deps`：`npm audit --omit=dev --audit-level=high`。High/Critical以上を失敗条件とし、開発用依存は検査範囲から除外。
- `npm run scan:dist:secrets`：ビルド済み`dist/`のテキスト資産を走査し、秘密鍵、GitHub/AWS/Google/OpenAI等の具体的な高リスク認証情報パターンを検出。ログに秘密値を出さない。バイナリ等は対象外であることを件数として報告。

初回合格証拠：PR #26のCI run `43011769052`（本番依存 `found 0 vulnerabilities`、`dist/`テキスト14ファイル・269667バイトで検出0、その他7アセットはテキストスキャン対象外）。その後、成果物保存処理を含めたコミット `cde4b380458ba8d594d72783fa78af992fdf602d` の品質ジョブで同検査成功。上記の範囲と限界を踏まえてA5をPASS。

**正式な公開候補には、PR #6最終HEADのCIで2検査が成功していることを適用する**。最初のCI結果だけを別SHAの承認に流用しない。

## A1：配布ビルドとソースSHA・成果物の追跡 — 最終HEAD確定時にPASS

- `package.json` の製品版：`1.0.0`。
- 統合候補のGitHub Actions品質ジョブは、`npm run build` → `npm run audit:distribution` → `npm run scan:dist:secrets` を実行し、**検査した同じ`dist/`をartifactとして保存**する。
- artifact名：`mask-unmask-dist-<PR_HEAD_SHA>`（保存期間14日）、GitHub Actionsにartifact ID・ダイジェストが記録される。
- **マージするSHAはPR #6 の最新HEAD**。ドキュメントが統合されるとHEADが変わるため、最終SHA・対応するCI run URL・artifact名/ID/ダイジェストをPR #6のリリース承認コメントで固定する。
- 最終HEADに対応する2ジョブSuccessと配布artifactが確認できれば、A1は**公開前PASS**。Cloudflare deployment IDは**公開後の検証結果欄**に記録する。実際の本番切替がまだであることを理由にA1をNOT_RUNに据え置かない。

## A6・A7とその他Gate Aの扱い

2026-11-11の管理者確認の申告に基づく再審査（`docs/release-gate-admin-reassessment-2026-11-11.md`）を引き継ぐ。A6は利用したAIサービス条件と素材権利の確認申告、A7はCloudflareの権限・未実演リスク確認申告と復旧手順を証拠にPASS。非公開の契約やアカウント設定を公開GitHubへ記録しない。旧Productionのロールバック操作の実施成功を主張しない。

Gate Aの既存9件の最終期待値（PR #6最終CI成功およびartifact存在を条件）：

| 確認事項 | 判定 |
|---|---|
| A1 ビルドとコミット・配布成果物追跡 | PASS（最終SHA/CI/artifactをPR #6コメントへ固定した時点） |
| A2 必須テストと主要動線 | PASS（最終CI両ジョブ成功） |
| A3 既知の重大データ損失なし | PASS（オーナー表明・保存ロジック同一） |
| A4 永続形式変更時の移行検証 | N/A（変更なし） |
| A5 本番依存脆弱性・秘密情報混入 | PASS（最終CIの2検査成功） |
| A6 OSS・プライバシー・権利等 | PASS（管理者確認と既存の配布物監査） |
| A7 公開停止・復旧手段 | PASS（管理者確認・既存運用手順） |
| A8 非公開脆弱性報告経路 | PASS（既存フォーム到達確認） |
| A9 課金・有料配布規制 | N/A（無料Web） |

**Gate B**：前回のB1〜B4のNOT_RUNは別のGate A確認項目にすり替えず、リリース責任者が影響と回避策を判断する。主な既知の緩和策はREADME・画面FAQ・既存の表示テスト・Viteハッシュ付きアセット・旧版復旧候補。未実施の全面的なアクセシビリティ・実CDNキャッシュ検証は実施済みと称さない。Gate Aに重大波及がないという判断が得られた場合、マスター規定の「条件付き可」を使用可能。

## 公開判断・実施主体

- この文書をリポジトリへ追加する作業と、`integration`での自動検証は実施者側で進める。
- **`main`へのPR #6のマージは製品オーナーが自ら実行する。** このチャット上の代理作業はしない。
- PR #6最終SHAのCIとartifactが成功/存在し、Gate A全PASSまたは理由付きN/Aであることを確認した後、リリース責任者がBの残課題を許容するなら、公開判定は**条件付き可**。公開後の結果を観測する前に「デプロイ済み」と記録しない。
- 重要なCI検査が失敗した場合やartifactが生成されない場合はリリース不可のまま。

## オーナーが実施するmainマージ手順

1. https://github.com/digi-garden/mask-unmask/pull/6 でマージ先が`main`、変更元が`integration/mu-compliance-acceptance`であることを確認。
2. 最新HEAD SHA、上記品質ジョブとE2Eジョブの成功、同SHA名のdist artifactが存在することを確認。リリース承認コメントに固定された数値と照合。
3. マージ操作を実施する。**統合ブランチのHEADと同一のリリース追跡性を優先する場合は、通常のMerge commit方式を使い、Squash/Rebaseで別のビルド対象に再構成しない**。実際に`main`に入ったコミットを記録する。
4. Cloudflare Pagesの`mask-unmask`プロジェクトで、新しい成功Production deployment IDとmainのコミットを記録する。カスタムドメインが該当版になっていることを確認する。
5. 同じ版のソースと配布artifactで`npm run verify:production`、`npm run verify:production:browser`、`npm run verify:production:oss` を実行し、3件の結果とdeployment IDをリリース記録に追記する。いずれかFAILなら運用文書の復旧判断手順を適用する。

## 公開後検証記録（未公開のため未実施）

| 記録対象 | 状態／実際の結果 |
|---|---|
| mainへマージしたSHA | **NOT_RUN**（オーナー実行後に記入） |
| Cloudflare成功Production deployment ID | **NOT_RUN** |
| https://circle-note.com/mask-unmask/の配信SHA/アセット | **NOT_RUN** |
| `npm run verify:production` | **NOT_RUN** |
| `npm run verify:production:browser` | **NOT_RUN** |
| `npm run verify:production:oss` | **NOT_RUN** |
| 実施日時/記録者・結果 | **NOT_RUN** |

本書は公開前の承認・実施・公開後の完了記録を混同しない。追加の独立ゲートを導入しない。
