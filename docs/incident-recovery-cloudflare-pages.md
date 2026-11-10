# MU-COMP-008 Cloudflare Pages 重大障害時の停止・復旧判断

## 対象と現在確認済みの環境

本書は `docs/release-process.md` と `docs/rollback-rehearsal.md` の補足。唯一の公開判定マスターは `digi-garden/brand-assets` 固定SHA `31bf40e921661c9c8e7b246434b349ad71c7c578` の `templates/release/product-release-checklist.md`。

- 公開サイト：`https://circle-note.com/mask-unmask/`
- Cloudflare Pages本番プロジェクト：`mask-unmask`、GitHub `digi-garden/mask-unmask`、Productionブランチ `main`。本番ブランチpushが自動デプロイされる構成を管理画面で確認した。
- 確認済み現行Production：commit `b7244ba`、deployment ID `1f73eb57-db3b-4309-9182-7de2e8563933`
- 基本動作確認済み過去Production：commit `009fd43`、deployment ID `e495e78b-d243-4463-8a73-e7e52d7dcc6b`
- `Rollback to this deployment` メニュー表示を確認。本番で**実際にロールバックしたことはない**。
- プロダクトは静的Web、バックエンドAPI/DBなし。ブラウザの`sessionStorage`には機密入力や置換マップが一時的に存在する場合がある。静的ファイルを差し戻してもセッションデータが消去・復元されるわけではない。

## 障害発生時の決定フロー

1. **検知・記録**：検知時刻、影響URL、現行デプロイID、直前の成功したデプロイ、再現条件を記録。秘密情報やユーザーの実際の入力は記録しない。
2. **重大性の判定**：入力の外部送信疑い、機密漏洩、誤復元・重要なデータ損失、CSP消失、法令必須表示欠落、主要動線停止なら重大として公開継続可否を直ちに評価。
3. **選択肢の比較**：
   - 旧版が安全と確認でき、ブラウザ保存形式に破壊的非互換がなければ既存の成功したProductionへの**ロールバック**候補。
   - 旧版にも問題がある、保存互換性不明、または重大な秘密流出が継続するなら、**安全な修正版の再配備**か**利用停止の案内・入口遮断**を選ぶ。
   - 「公開停止」はPagesのDeployment削除を意味しない。既存のPagesプロジェクトに専用の無害化ページをデプロイする方法、カスタムドメイン側でのアクセス制御等を検討し、実在する機能・権限・影響を確認してから実施する。**Cloudflare管理画面に存在未確認の停止ボタンを前提にしない**。
4. **二重確認**：対象アカウント、Pagesプロジェクト、ProductionかPreviewか、対象deployment ID、操作後の公開URLを確認。ユーザー/運用担当の明示的判断なしに本番切替を実行しない。
5. **実行後の検証**：公開されたHTML/JS/CSSの整合とコミット・配布アセット識別、CSP/セキュリティヘッダー、直接アクセス、架空データでMask/Unmask/クリア、通信なし、ブラウザの既存`sessionStorage`との互換性、キャッシュ混在を確認。
6. **対外対応と記録**：影響・復旧タイムライン・残余リスク・利用者案内・脆弱性の非公開受付導線・必要な法令届出について判断し、リリース/インシデント記録に追記する。

## Cloudflare固有の注意

- Pagesの**成功したProductionデプロイ**のみがロールバック候補。Previewを候補と取り違えない。
- ロールバックで選択すべき対象はブランチ名や日付だけでなくdeployment IDまで照合する。
- `main`への新規pushは自動デプロイに繋がる。障害時の意図しない再配備を避けるため、CI/デプロイ設定の変更を勝手に行わない。
- 異なるHTML/JS/CSSがCDNやブラウザキャッシュで混在し得る。実URLと固有アセットハッシュの照合で復旧を判断する。
- 恒久的な利用停止手段（カスタムドメインのアクセス制御・遮断、案内ページへの差し替え等）の**実行権限と運用方法は未実証**。停止手段を確保したと無条件にPass判定しない。

## 未完了項目（公開前のリスク判断が必要）

| 課題 | 状態 |
|---|---|
| 既知の正常Productionへの復旧候補確認・基本操作 | PASS |
| Cloudflare Pagesのロールバック操作メニューの存在 | PASS |
| 本番での実ロールバック／復旧動作 | NOT_RUN |
| 隔離Pagesプロジェクトでのロールバック訓練 | NOT_RUN（別手順書に計画） |
| 実効性のある公開停止手段・権限の実操作確認 | NOT_RUN |
| 重大障害時の利用者への具体的な案内文・責任者最終判断 | NOT_RUN |

本書は状況別判断のドキュメントであり、実行していないCloudflare操作の成功を宣言するものではない。

Cloudflare公式参考：https://developers.cloudflare.com/pages/configuration/rollbacks/

## 追加：具体的な封じ込め・復旧順（MU-COMP-004・008一括評価）

### 対策選択の優先順位

1. **安全な成功済みProductionへ切り戻せる場合**：最初にCloudflare Pagesの `Deployments > All deployments` から既知の正常Productionを特定し、SHA・deployment ID・対象ドメインとプロジェクトを照合。承認者がロールバック操作を行う。Cloudflare公式手順ではPreviewデプロイをロールバック先にできない。旧版が事故原因を含むときは実行禁止。
2. **旧版が安全と判断できない場合**：対象の機能利用を停止し、無害な保守案内の配置かルーティング層での遮断を選ぶ。保守案内ページの配置だけで、キャッシュ済みJSや既存セッションの利用継続を抑止できるわけではない。
3. **カスタムドメインでの緊急遮断が必要な場合**：Cloudflare WAF Custom Ruleの `Block` を候補とする。あらかじめ `http.host eq "circle-note.com"` かつ `http.request.uri.path eq "/mask-unmask"` または `starts_with(http.request.uri.path, "/mask-unmask/")` で対象パスのみに限定する方針を採る。**設定可否・適用プラン・実際の対象ゾーン権限・ルール優先順位と作用範囲は未確認**であり、運用担当の確認なしに追加/有効化しない。このルールは`*.pages.dev`の直接ドメインや既存ブラウザセッションまで遮断することを意味しない。必要な場合はPagesのプロジェクト設定・直接アクセス経路も別途対策する。
4. **問題を修正した後**：問題の種類に応じて安全なリリース候補をCI・プレビューで検証し、明示的な承認後に本番復帰。WAF遮断を解除する場合も対象ルールを二重確認し、URL・レスポンス・CSP・匿名データでの動作とネットワーク通信を再確認。

### 実行権限・未実施の扱い

- このリポジトリから使えるGitHub操作はCloudflare Pagesの管理者操作を代替しない。アクセス権限、ロールバックの**実押下**、WAF設定の**作成・適用・解除**、Pages本番の**新規デプロイ**は、ユーザー/運用担当による承認・実行の記録が必要。
- `npm run verify:recovery:candidates` は既知の2つのデプロイ固有URLのHTMLとJSを**読み取り専用**で確認し、SHA-256を記録する。Cloudflareの管理画面やDNS設定を変更しない。実際のロールバック能力、カスタムドメインの経路、権限、キャッシュ・セッションは実証しない。
- 万一デプロイIDが別のものに変わった場合は推測でIDを書き換えず、Cloudflareの管理画面の実際のProduction履歴と対応コミットを再照合する。
- 機密情報の外部流出事故では、画面停止やWAF遮断のみで既流出データを回収できない。脆弱性の非公開連絡・影響範囲・必要な通知や届出を別途検討する。

### オペレーション記録様式

| 記録項目 | 未実施時の記載 |
|---|---|
| 障害発見時刻・再現条件（秘密情報を除く） | NOT_RUN |
| 対象Pagesアカウント・プロジェクト・ルートドメイン | NOT_RUN |
| 操作者・判断者・実行許可 | NOT_RUN |
| 事前Production deployment IDと安全性判断 | NOT_RUN |
| 選択した処置（ロールバック / 遮断 / 保守案内 / 修正再デプロイ） | NOT_RUN |
| 実行日時・操作対象ID・結果 | NOT_RUN |
| `/mask-unmask/`・旧アセットのHTTP検証 | NOT_RUN |
| `*.pages.dev`等の代替経路確認 | NOT_RUN |
| ブラウザの既存sessionStorageとキャッシュ互換性 | NOT_RUN |
| 復旧確認・再開承認・監視終了 | NOT_RUN |

### 参照した公式仕様（2026-11確認）

- Pages Rollbacks: https://developers.cloudflare.com/pages/configuration/rollbacks/
- Cloudflare WAF Custom Rules: https://developers.cloudflare.com/waf/custom-rules/

**結論：これらは停止・復旧方法の実行可能な候補と検証条件を具体化するもの。設定の存在や実効性を検証した証拠ではない。**
