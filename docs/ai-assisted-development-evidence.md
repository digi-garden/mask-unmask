# MU-COMP-007 AI支援開発の検証・採用記録

## 適用規約

`digi-garden/brand-assets` 固定コミット `31bf40e921661c9c8e7b246434b349ad71c7c578`、`guidelines/digi-garden-development-operations-guidelines-v1.0.md` 第6節・第6.1節による。

AIが行った検証と人間が行った検証を分離し、実施していない作業を完了扱いにしない。PR/CIの記録はテスト実施の証拠であり、AIサービスのデータ利用条件の確認や法務監査を自動的に証明しない。

## 今回の範囲・指示・採用条件

| 項目 | 記録 |
|---|---|
| 対象製品・リポジトリ | Mask & Unmask / `digi-garden/mask-unmask` |
| 上位規約 | `digi-garden/brand-assets` fixed SHA `31bf40e921661c9c8e7b246434b349ad71c7c578` |
| 対象ブランチ | `integration/mu-compliance-acceptance`。公開中の `main` は変更しない |
| 作業目的 | MU-COMP-001〜008の規約適合に向けた是正・検証 |
| 完了条件 | コード・文書・自動検証・根拠URL、必要な実操作の証跡を区別して記録し、共通マスターで公開前判定する |
| 禁止事項 | 実データやAPIキーを検証入力に使わない。Gate A未判定で`main`へマージ／本番デプロイしない。未実施の操作をPassとしない |

## 検証済みのエビデンス（対象と限定）

| 分野 | 証跡 | 確認済み範囲 |
|---|---|---|
| 型・ユニット・ビルド・E2E | <https://github.com/digi-garden/mask-unmask/actions/runs/42316281132> | PR #11統合時のCI両ジョブ成功。後続の統合コミットでは再実行必須 |
| 脆弱性報告 | <https://github.com/digi-garden/mask-unmask/pull/1> / `SECURITY.md` | 非公開フォームを管理者以外の利用者が表示できることを手動確認 |
| 文字コントラスト・見出し | `tests/e2e/accessibility.spec.ts` | 指定した代表領域のChromium自動テスト。全面的WCAG適合検査ではない |
| 通信プライバシー | `tests/e2e/network-privacy.spec.ts` | 初期アセット読込後の架空データのMask/Unmask/クリア操作で予期しないHTTP通信がない |
| 現行公開版のHTTP・CSP | `scripts/verify-production.mjs` | 利用者の実行によるHTTP smoke試験成功 |
| 現行公開版のブラウザ | `scripts/verify-production-browser.mjs` | 利用者の実行による架空データの操作・追加HTTP(S)・CSP違反なし |
| 現行公開版のJSON往復 | 利用者の手動確認 | エクスポート、クリア、インポート、Unmaskで `[CN_EMAIL_0001]` が `test@example.com` に復元 |
| 依存脆弱性 | PR #7 / CI | `npm audit` 0件の環境で修正・検証（将来の依存更新時は要再評価） |
| OSS通知のビルド生成 | PR #9/#10 / `scripts/copy-runtime-licenses.mjs` | ローカル`dist`へのランタイム依存ライセンス原文の配置・ハッシュ検査。公開済み本番配布物の検証ではない |
| 本番復旧候補の基本動作 | `docs/rollback-rehearsal.md` | 旧Production `009fd43` を利用者が直接表示し、架空メールのMask/Unmask/クリアを確認 |
| ロールバック実操作 | 未実施 | Cloudflare Pagesのメニューと復旧候補は確認済み。本番切り戻しはNOT_RUN |

## AI利用状況とレビュー

- 仕様、差分、テスト・証拠をもとにAI支援で是正案・テスト・運用文書を作成。GitHub上のPR/commit/CIを追跡可能な形で保持する。
- AIが作成したコードは採用前に差分・CIを確認し、実ブラウザ・Cloudflare管理画面・実運用に関わる判断は未実施を明記する。
- 依存OSSの利用条件確認と本番配布物の最終チェックは `MU-COMP-005` として継続。
- **AIサービスの具体的な契約・設定・学習利用／保持期間／共有設定の確認記録は、このGit履歴から確認できないためNOT_RUN**。これを確認済みと偽らない。非公開の設定・契約詳細を公開リポジトリへ無断記載しない。
- 作業者による正式な差分レビュー、Gate A/Bの最終承認、公開の承認は別途必要。

## 今後の更新条件

新たな統合コミット・リリース候補SHAの確定時に、対象SHAに対するCI実行URL・結果、未実施手動検証、AIサービス入力条件の確認状況を付録またはリリース単位の記録として追加する。本書を正式なリリースチェックリストの代替にしない。

## 最終照合の記録

MU-COMP-007の実装証跡とサービス利用条件の確認ゲートについては、最新版の [`docs/ai-assisted-development-final-review.md`](ai-assisted-development-final-review.md) を参照する。旧CI例の記載は過去時点の証拠であり、最新の統合コミットに対するCIの代替としない。管理者権限が必要な契約/保持/共有の確認は未実施のため、正式な適合認定と混同しない。
