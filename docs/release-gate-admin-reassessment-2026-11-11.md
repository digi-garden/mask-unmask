# Mask & Unmask Gate A再審査（管理者確認反映）

- 再審査日：2026-11-11（JST）
- 対象：`digi-garden/mask-unmask` `integration/mu-compliance-acceptance`（審査開始時HEAD `c0a38a992431141b6767b7ede8138b21aac234df`）
- マスター：`digi-garden/brand-assets` commit `31bf40e921661c9c8e7b246434b349ad71c7c578` の `templates/release/product-release-checklist.md`
- CI：https://github.com/digi-garden/mask-unmask/actions/runs/42958070031 （上記HEAD、型チェック・テスト・ビルド／E2E両ジョブsuccess）
- 参照：`docs/release-gate-review-2026-11-11.md`、`docs/mu-comp-005-007-closeout.md`、`docs/recovery-closeout-assessment.md`、`docs/oss-distribution-compliance-final-review.md`
- 外部AIレビュー：2026-11-11 Claude読み取り専用レビュー（ユーザー提供 `mask-unmask-gate-a-admin-review.md`）。このファイルの主張は追加の独立検証を行ったこととは区別する。

## 管理者確認の取得事実

2026-11-11、製品管理者が以下の**3項目について「確認済み」**と明示した。

1. **AIサービスの利用条件：確認済み**（学習利用、保持、共有等を対象とするレビュー依頼項目）。
2. **ブランド素材の権利帰属：確認済み**（自作または利用権限の保有を対象とするレビュー依頼項目）。
3. **Cloudflare権限と復旧リスク：確認済み**（アカウント権限および未実演のリスク受容を対象とするレビュー依頼項目）。

**証跡の限界：** チャットにあるのは各確認結果の申告であり、実際のAIサービス名・学習利用設定値・データ保持日数、権限ロール名、個々の作品の権利契約や非公開メモの所在は提示されていない。秘密情報をGitHubへ貼らない方針を維持し、確認申告を契約原本・管理画面の独立検査と混同しない。以降の判定は、この3つの管理者申告を根拠に含める。

## Gate A再判定（9項目）

| # | 内容 | 2026-11-11初回 | 再審査 | 根拠と制約 |
|---|---|---|---|---|
| A1 | 配布ビルドの成功、SHA/版/配布物の追跡 | NOT_RUN | **NOT_RUN** | 統合版CIは成功。公開用の最終ソースSHAと同一成果物のリリース/CloudflareデプロイIDの対応をまだ確定していない。公開前に凍結して記録する |
| A2 | 必須テストと主要動線 | PASS | **PASS** | 上記CIでTypeScript・単体・性能・ビルド・Chromium E2E成功。公開後の実配信スモークは別記録 |
| A3 | 既知の未解決重大データ損失がない | NOT_RUN | **NOT_RUN** | `src/hooks/usePersistedState.ts`、`src/utils/maskEngine.ts`、`src/components/UnmaskTab.tsx` は旧mainと同一。GitHubの「data loss security vulnerability」検索で対象open issueは検出されず。ただしこの検索だけでは既知問題の全数や管理者の重大不具合レビューを証明しない |
| A4 | 永続形式変更時の移行 | N/A | **N/A** | 主要な保存ロジック・マスク変換ロジックがmainと同一、永続形式変更なし |
| A5 | 秘密情報混入なし・重大未対処セキュリティ問題なし | NOT_RUN | **NOT_RUN** | CSP/プライバシーE2Eと従前のnpm audit実績はある。最新候補SHAの依存脆弱性確認と実際の配布物の秘密情報混入検査について十分な証跡がまだない |
| A6 | 適用法務、プライバシー、OSS、権限等 | NOT_RUN | **PASS（管理者の確認申告と既存技術証跡に基づく）** | MIT5件/OFL同梱、原文SHA-256・JS由来E2E、正式ロゴのブランド正本同一性は外部AIレビューで報告。管理者はAI条件・素材権利を確認済みと申告。フォントVersion 4.504とロゴ4件バイト一致は外部AIの調査結果で、当方の独立再検証ではない。新たなOSS通知の**本番配信**は公開後に `npm run verify:production:oss` で確認する。公開後に失敗した場合はリリース事故として復旧手順に従う |
| A7 | 配布方式に応じた停止・復旧手段 | NOT_RUN | **PASS（管理者の確認申告と既存技術証跡に基づく）** | Cloudflare Pages旧成功Production、Rollbackメニューと`main`への再デプロイ経路が既知。管理者がCloudflare権限と未実演リスクを確認済みと申告。実ロールバック、WAF遮断、緊急停止の効果は依然NOT_RUN。旧URLやキャッシュ済みJSが残り得るため、「旧成功版への戻し」は全アクセス経路の即時遮断を意味しない |
| A8 | 非公開の脆弱性報告導線と実接続 | PASS | **PASS** | SECURITY.md／Private Vulnerability Reporting、非管理者によるフォーム確認済み |
| A9 | 課金・有料配布時の義務 | N/A | **N/A** | 無料Web製品で決済・ストア販売なし |

**Gate A再集計：PASS 4、N/A 2、NOT_RUN 3、FAIL 0。**

A6・A7のPASSは、ユーザーからの管理者確認申告と、既存のCI・手順・外部AIレビュー結果を根拠とする。管理者が実確認を行っていない場合や申告に誤りが判明した場合はPASSを取り消す。特定の法律に対する保証やCloudflare切替の実証と同義ではない。

## Gate B（再審査対象外）

2026-11-11初回審査のB1〜B7は今回新たな検査証跡を取得していないため、**PASS 0、N/A 3、NOT_RUN 4** を据え置く。各NOT_RUNの利用者影響・緩和策は最終リリース判定で記録し、Aへの重大波及がないことを確認する。

## リリース判断と技術側残件

**今回の結論：管理者判断3件の受付・Gate A再審査は完了、ただしリリース判定は引き続きNo-Go（公開不可）。** A1、A3、A5の重要なNOT_RUNは未解消。

- **A1（リリース成果物）**：コミットを凍結し、同じコミット/版に紐づくCIビルド証跡を固定する。デプロイIDは公開後に記録する。公開前・公開後を混同しない。
- **A3（重大問題）**：既知問題の責任者レビューと、既存のストレージ/変換/JSON往復E2E結果の照合を記録する。
- **A5（セキュリティ）**：最新候補に対する脆弱性検査、成果物の秘密情報の混入チェックを実行し、検出結果と例外判断を記録する。秘密の実値はログへ出さない。
- **公開後の検証**： `verify:production`、`verify:production:browser`、`verify:production:oss` と新Cloudflare deployment IDを結び付ける。

**本書は再審査記録のみ**。統合PR #6を`main`へマージしたり、Cloudflare/WAF/DNSを操作したりしない。上記3件の重要な未実施事項を根拠付きで解消してから正式に公開承認を取得する。
