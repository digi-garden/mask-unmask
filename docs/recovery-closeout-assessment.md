# MU-COMP-004・008 復旧・公開停止対応の収束判定

- 対象: `digi-garden/mask-unmask` の `integration/mu-compliance-acceptance`
- 正本: `digi-garden/brand-assets` 固定 `31bf40e921661c9c8e7b246434b349ad71c7c578`、`templates/release/product-release-checklist.md`
- 判定の種類: **リリース前の技術・手順整備の完了判定**。本番復旧能力の実証や公開Gate Aの正式Passとは区別する。
- この作業で実際のCloudflare Pages Production、WAF、DNS、`main`、一般利用者のsessionStorageを変更しない。

## 運用環境の確認済み事実（履歴上の証拠）

| 観点 | 確認事項 | 根拠の範囲 |
|---|---|---|
| 配信 | Cloudflare Pages `mask-unmask`、Productionブランチ `main`、公開URL `https://circle-note.com/mask-unmask/` | 既存管理画面の過去確認・既存の本番スモーク |
| 履歴上のProduction | commit `b7244babaf225d98d7a14e4c0344a6207b50033e` / deployment `1f73eb57-db3b-4309-9182-7de2e8563933` | 過去の観測。今この時点の最新Productionであることまでは再確認していない |
| 旧成功Production候補 | commit `009fd43c35e8e98b2c61994439f21adc1acdd388` / deployment `e495e78b-d243-4463-8a73-e7e52d7dcc6b` | 旧URLの直接表示・仮名化・復元・クリア（合成データ）の既存確認 |
| ロールバック経路 | 旧Productionの画面に `Rollback to this deployment` が表示された | **ボタンを押して実際に復旧した証拠ではない** |
| 公式仕様 | 正常にビルドされたProductionだけがロールバック候補。Previewは対象外。旧成功Deploymentから新しい成功Deploymentへ戻すことも可能 | https://developers.cloudflare.com/pages/configuration/rollbacks/ |
| 対象アプリの状態 | 静的Web + ブラウザ `sessionStorage`。サーバーのDB復旧手順は不要 | ユーザーデータをロールバックが復元することはない |

## 今回完了する作業（技術・運用文書）

1. 既存 `docs/release-process.md` と `docs/rollback-rehearsal.md`、`docs/incident-recovery-cloudflare-pages.md` の対応を整合。
2. `npm run verify:recovery:candidates` を提供。対象IDを固定した旧・現行の直接デプロイURLからHTML/JSを**読み取り専用**で取得し、応答状態・アセット取得・SHA-256をレポートできる。実行そのものはGitHub CIで自動実行しない（外部環境に依存するため）。構文はCIで検証。
3. 想定事故別の選択を整理：**旧版が安全**なら確認済みProductionへの切り戻し、**旧版も危険**なら公開アクセスの封じ込めと修正版再配布。
4. 公開停止の具体的選択肢として、Cloudflare WAF Custom Rulesの **Block** をカスタムドメイン側の`/mask-unmask`配下へ限定して適用する案を記録。適用可能なゾーン・権限・料金プラン・ルール順序は現場で未確認のため有効化しない。Pagesの `*.pages.dev` 直接URL、キャッシュ済みアプリ、ブラウザ内データが別途残るリスクも記録。
5. 責任者・実施時刻・対象デプロイID・外部アクセス経路・旧新アセット・ブラウザ内データ互換性・復旧成功を**実際の操作後**に確認する手順を記録。

## 現時点の判定

| ID | 履行項目 | 現状 |
|---|---|---|
| 004 | 既知成功Productionの特定と直接URLの基本動作 | **PASS（過去実証）** |
| 004 | 操作手順・安全な隔離訓練計画の整備 | **PASS（文書整備）** |
| 004 | Cloudflare Pages上の**実際のロールバック**・新旧切替・復帰 | **NOT_RUN** |
| 004 | 管理画面アクセス権と復旧時の実操作成功 | **NOT_RUN** |
| 008 | 重大障害の判断・対応手順・利用者向け案内観点 | **PASS（文書整備）** |
| 008 | Cloudflare WAFの対象パス遮断・権限・`pages.dev`への影響 | **NOT_RUN** |
| 008 | 既存sessionStorage・CDNキャッシュ・旧新資産の復旧実証 | **NOT_RUN** |

**収束範囲**：こちらで変更できるソース・証跡・運用文書・安全な事前検証の準備は完了。**本番復旧機能の実証とGate A正式判定は未完了**。本番ロールバックは意図しない公開切替を生むので、この是正作業中には行わない。隔離訓練の実施判断は承認者が行う。

## 本番権限者の最小限の確認（操作せず見るだけでよいもの）

- Cloudflare Dashboardで対象の**アカウント・Pagesプロジェクト名・Production履歴**と対応SHAを確認し、旧成功Productionがなおロールバック可能な状態か確認する。
- 旧成功ProductionのアクションにRollbackメニューが存在するか再確認（押下しない）。対象プロジェクトへの操作権限も確認。
- `circle-note.com` のCloudflareゾーンが管理下にあり、WAF Custom Ruleが使えるプラン／権限か確認。利用できなければ保守案内や修正版再配布を代替案とする。
- 本番切替やWAF遮断など**実際に公開影響のある操作は別途明示的に承認**したときだけ実施する。

## リリースGateへの反映

- MU-COMP-004/008を「修正コードと運用設計の残件」として繰り返す必要はない。
- マスターGate Aの「公開停止・復旧確認」に**実操作の証拠が必須か、既知成功Production・操作権限確認・代替の安全策・未実証リスク受容で判定可能か**はリリース責任者が実情に即して決定する。規約が明示しない「本番ロールバック必須」を勝手に追加しない一方、未実施をPassにすり替えない。
- `main`マージ後はCloudflareの新しいデプロイIDを記録し、戻し先候補の健全性を再確認。本番公開・停止・復旧を経験した際には実証結果で更新する。
