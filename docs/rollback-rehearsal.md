# MU-COMP-004 Cloudflare Pages ロールバック訓練計画と証跡

## 位置付けと禁止事項

この計画は実機で確認した Cloudflare Pages `mask-unmask` の本番・履歴・動作結果を踏まえる。リリース判定の唯一のマスターは `digi-garden/brand-assets` の固定コミット `31bf40e921661c9c8e7b246434b349ad71c7c578` における `templates/release/product-release-checklist.md` とし、本書で Gate A を緩和しない。

- 実施前の本番は `main` の `b7244ba`。Production deployment ID は `1f73eb57-db3b-4309-9182-7de2e8563933`。
- 過去の Production `009fd43`、deployment ID `e495e78b-d243-4463-8a73-e7e52d7dcc6b` はビルド成功・旧版直接URLでのMask/Unmask/クリアが確認済み。
- 過去の Production のアクションに `Rollback to this deployment` が表示されることを確認済み。
- **実際の本番ロールバック・ロールバック後の復旧確認は未実施**。これはMU-COMP-004の最終Passではない。
- 既存 `mask-unmask` プロジェクトのProduction切替、`main` の変更、実トークンや実データの投入、ユーザーデータの収集は禁止する。訓練と公開を混同しない。

## 重要：既存Previewはロールバック対象ではない

Cloudflare Pagesの公式仕様では**成功したProductionデプロイ**のみがRollback先に指定でき、Previewデプロイは指定できない。このため既存のPreview URLsを開くだけではロールバック機能そのものの訓練にならない。

参照：https://developers.cloudflare.com/pages/configuration/rollbacks/

## 推奨：隔離された訓練専用Pagesプロジェクト

本番を変更せず実際のロールバックを操作するには、Cloudflare上で**別のPagesプロジェクト**（例：`mask-unmask-rollback-drill`、名称と作成可否は管理者が決定）を新設する。GitHub上のProductionブランチ設定や本番ドメインは変更しない。訓練専用プロジェクトの `*.pages.dev` URLだけ使用し、カスタムドメインは接続しない。

構築手段は専用のDirect Upload Pagesプロジェクトに対して **既知の2つの異なるコミットのビルド成果物** を順にProductionとしてデプロイする方式を第一候補とする。作業者が管理画面・操作権限・利用制限を確認するまで作成・アップロードは実行しない。Direct UploadとGit連携の設定方式を混同しない。

### 訓練計画（実施後に各項目の証跡を埋める）

1. **開始前**：本番の `https://circle-note.com/mask-unmask/` が正常で、`mask-unmask` のProductionが `b7244ba` のままであることを記録。作業日時・担当・連絡経路・中断条件を明記する。
2. **隔離先の確認**：別のPagesプロジェクト名・公開URL・Production設定・アカウント・権限を確認。本番 `mask-unmask` とは別のプロジェクトであることを二重確認。
3. **訓練用旧版A**：既知の正常なコミットから `npm ci`、`npm run build` で生成した `dist/` を訓練専用プロジェクトのProductionとしてデプロイ。commit SHA・deployment ID・デプロイURL・各検証結果を記録。
4. **訓練用新版B**：別の既知コミットから同様にビルドし、同プロジェクトのProductionへデプロイ。**AとBを区別するビルドファイルのハッシュなどの識別情報**を保存。A/Bは機能・CSP等の基本安全性に問題がない版を選ぶ。
5. **ロールバック実証**：訓練専用プロジェクトで過去の成功した**Production A**のメニューから `Rollback to this deployment` を選び、対象IDを再確認した後に限り実行する。
6. **復旧確認**：訓練専用の本番URLからA固有の静的アセットを取得でき、Bのアセットを誤配信していないことを確認。HTML/JS/CSSのキャッシュの影響・CSP・Mask/Unmask/クリアを架空データで確認。
7. **新版への復帰**：Cloudflare Pagesの仕様上可能な、成功済みの新版BのProductionへのロールバックを行い、同様に成果物IDと基本動作を確認。失敗した場合は実施を中断し原因を記録。
8. **終了時**：既存 `mask-unmask` プロジェクトのProductionコミット・デプロイIDが訓練前から不変であることを確認。訓練用環境の扱い（維持・非公開化・削除）は運用担当が判断する。

## 証跡記録（未実施項目はNOT_RUNのまま）

| 項目 | 値 | 判定 |
|---|---|---|
| 現行本番コミット | `b7244ba` | PASS（2026-11-07の管理画面） |
| 現行本番deployment ID | `1f73eb57-db3b-4309-9182-7de2e8563933` | PASS |
| 旧本番候補コミット | `009fd43` | PASS |
| 旧本番deployment ID | `e495e78b-d243-4463-8a73-e7e52d7dcc6b` | PASS |
| 旧版のMask/Unmask/クリア | 架空のメールアドレスで正常 | PASS（利用者の手動確認） |
| Rollback操作メニュー表示 | 旧Productionで確認 | PASS |
| 訓練用プロジェクトURL | 未確定 | NOT_RUN |
| 訓練A/Bのcommit SHAとdeployment ID | 未確定 | NOT_RUN |
| 訓練Aへの実ロールバック | 未実施 | NOT_RUN |
| 訓練Bへの復帰・動作確認 | 未実施 | NOT_RUN |
| **本番プロジェクト自身での実ロールバック** | **未実施** | **NOT_RUN** |

### Gate判定上の制約

独立した訓練用プロジェクトでの成功は、**Cloudflare Pages上で手順と操作権限が成立することの証拠**にはなるが、対象本番プロジェクトの設定・権限・CDN・ドメイン・セッション互換性までの本番復旧実証を意味しない。正式判定では「訓練環境でPass、本番の実ロールバックはNOT_RUN」と区別して共通マスターに記録し、本番未実施に伴うリスクを別途判定する。

Cloudflareの公式仕様：https://developers.cloudflare.com/pages/configuration/rollbacks/
