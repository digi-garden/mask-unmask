# MU-COMP-005 — OSS配布物の最終照合（リリース前証跡）

## 判定対象と結論

基準: `digi-garden/brand-assets` の固定コミット `31bf40e921661c9c8e7b246434b349ad71c7c578` における「法務・ライセンス文書管理規約 v1.1」および唯一のリリース判定マスター `templates/release/product-release-checklist.md`。

対象: `digi-garden/mask-unmask` の `integration/mu-compliance-acceptance` でビルドする **静的Webサイト**。ユーザーに提供するアプリのURLは `/mask-unmask/`。本番 `main` への取り込み・デプロイはまだ行っていない。

**判定: リリース前の配布物監査を自動化した段階。MU-COMP-005の最終Passは、公開後の配布物を確認してから記録する。** ローカルビルドとCIのPassだけで実際のProductionの法務適合を宣言しない。

## ライセンス別の照合台帳

| 対象 | 厳密な版 | ライセンス（根拠） | 生成物への関与 | 配布義務・対応先 |
|---|---|---|---|---|
| react | 18.3.1 | MIT（インストール済み `node_modules/react/LICENSE`） | Rollup JS モジュールとして確認 | 原文を `/mask-unmask/third-party-licenses/react-18.3.1-LICENSE` に同梱 |
| react-dom | 18.3.1 | MIT（`node_modules/react-dom/LICENSE`） | Rollup JS モジュールとして確認 | 同じディレクトリに `react-dom-18.3.1-LICENSE` |
| scheduler | 0.23.2 | MIT（`node_modules/scheduler/LICENSE`） | Rollup JS モジュールとして確認 | `scheduler-0.23.2-LICENSE` |
| js-tokens | 4.0.0 | MIT（`node_modules/js-tokens/LICENSE`） | lockfileで実行時扱い、最適化後のJSモジュールとしては非検出 | 保守的に `js-tokens-4.0.0-LICENSE` |
| loose-envify | 1.4.0 | MIT（`node_modules/loose-envify/LICENSE`） | lockfileで実行時扱い、最適化後のJSモジュールとしては非検出 | 保守的に `loose-envify-1.4.0-LICENSE` |
| Manrope（正式ロゴSVG内の埋込フォント） | 配布SVGに含まれるWOFF2。上流フォントの厳密なビルド版は**未確定** | SIL Open Font License 1.1。取得元 `google/fonts` の `ofl/manrope/OFL.txt`、Git Blob `e271172a9ed0cddc895aabb6509f1c7d880b492d` | `public/digi-garden-logo.svg` に `data:font/woff2;base64,` を確認 | `/mask-unmask/third-party-licenses/Manrope-OFL.txt` に著作権表示とOFL全文を同梱。フォントの上流正確な版と改変状況は別途確認課題 |

### 義務の解釈と適用

- **MIT**：ソフトウェアの全部または重要な部分の複製に、著作権表示と許諾表示の保持が必要。短いSPDX識別子のみでは代替しない。上表5件についてインストール済み原文ファイルを改変せず同梱しSHA-256で同一性を検証する。
- **SIL OFL 1.1**：フォントそのものの再配布に際し、著作権表示とライセンス条件が同行する必要があるため、ManropeのOFL原文を同梱。上流の厳密なフォントビルドとSVG内の埋込バイナリの同一性は、この監査だけでは立証しない。
- **その他の開発用依存**：`ffmpeg-static@5.3.0`（GPL-3.0-or-later）はデモ動画生成用で、通常の静的Webビルドに動画/ffmpeg実行ファイルは含めない。CI監査は `dist/` 内の実行ファイル・動画の混入を失敗扱いにする。ただしデモ動画を将来配布する場合は別審査が必要。`lightningcss`（MPL-2.0）、`caniuse-lite`（CC-BY-4.0）、`parse-cache-control`（lockfileで識別子欠落）なども開発用依存。lockfileの `dev` フラグだけを非配布の根拠にせず、Rollupの生成JSに開発用モジュールが取り込まれた場合はビルド失敗とする。CSSはビルド時生成物であり、CSSへの著作物寄与の完全な法的判定までは自動監査で証明しない。
- **ロゴ等のアセット**：ロゴ/図形そのものはブランド管理リポジトリ由来の自社素材として管理。埋込フォント部分の第三者ライセンスを上記OFLで別途扱う。PNG/faviconsは元となるアセットと制作権限を別途追跡する。

## 自動検証と監査対象

1. `npm ci` → `npm run build`：ローカルの再現ビルド。Vite/RollupはJSバンドルのモジュールパスからnpmパッケージ名・版・lockfileライセンスを抽出し、`dist/mask-unmask/bundle-provenance.json` に出力する。出所不明・dev-only・非MITの依存があればフェイルクローズ。
2. `npm run audit:oss`：lockfileの全依存と欠落SPDXメタデータを監査。
3. `npm run audit:distribution`：`dist/` 全ファイルをハッシュ化し、実行時5件の原文と配布先通知のSHA-256一致を検証する。さらにManropeのOFL原文との一致、バンドル由来JSONの構文とpackage-lock整合、デモ用バイナリ/動画の混入を確認。
4. Playwright E2E：アプリのOSSライセンス導線、マニフェストと各原文のHTTP配信、Manrope OFL配信、バンドル由来JSONの取得/解析を検証。

証跡: [PR #17](https://github.com/digi-garden/mask-unmask/pull/17) はビルド由来監査の導入。[本監査のPR]は実装後のCIログに紐付ける。

## 公開後の最小検証（自動化可能・まだNOT_RUN）

`main` にマージしCloudflare Pagesへ実際に配信した**後**、次の事項を確認する。公開前にProductionではテストできないため、これは必ず明確に`NOT_RUN`として残す。

- `https://circle-note.com/mask-unmask/third-party-licenses/README.md` へのHTTP GETが成功し、HTMLフォールバックではなくマニフェストが返る。
- そこに記載された5件のMIT原文とManrope OFLのHTTP GETが成功し、ローカルの配布原文と一致する。
- 同アプリのフッター「OSSライセンス」から実際に到達できる。ProductionのCSPや通信ポリシーとの矛盾がない。
- 公開対象のコミットSHA・CloudflareデプロイIDと検証したビルド成果物が対応している。
- ビルド以外の広告、計測SDK、フォント外部ホスト、プラグイン、追加静的ファイルがProductionに混入していない。

## MU-COMP-005判定

| 観点 | 状態 |
|---|---|
| 実行時依存5件のライセンス識別と原文のビルド同梱 | CI検証済み |
| 実行時依存5件の原文と配布原文のバイト同一性 | CI検証済み |
| JSバンドルに含まれるnpmモジュールの出所とライセンス | CI検証済み（React/React DOM/scheduler） |
| 埋込ManropeのOFL原文同梱と確認 | 今回CI検証を追加 |
| CSS、フォントバイナリの厳密な出所、その他アセットの権利・ライセンス | 未完全検証／適用根拠を追跡 |
| 現行**Production**に上記原文が配信されていること | **NOT_RUN（未デプロイ）** |
| MU-COMP-005最終Pass | **保留：リリース後の実配信と残存義務を確認して確定** |

ソースの実装上の事実・上流ライセンスの一般的な要求・リリース後にしか判定できない事実を分離し、Gate Aの重大未検証をGate Bへ振り替えない。

## 公開後の自動実査コマンド（リリース時のみ）

```bash
npm ci
npm run build
npm run verify:production:oss
```

`OSS_VERIFY_ORIGIN` は未指定なら `https://circle-note.com`。Cloudflare Pagesの検証用オリジンを対象にする場合のみ `OSS_VERIFY_ORIGIN=https://<preview-host>.pages.dev` として実行する。ローカルの `dist/mask-unmask/` と、公開された実URLのアプリHTML、バンドル出所JSON、すべてのMIT/OFL原文を1ファイルずつSHA-256照合する。意図せずHTMLフォールバックされた場合やコンテンツ相違ではFAILとする。

**注意：** 別のコミットで作った `dist` と公開済みProductionを比較すると必ずしも一致しない。必ず実際にデプロイしたコミットをチェックアウトしてビルド・検証し、CloudflareのデプロイIDをリリース記録に併記する。ビルドの再現性を保証できない場合は、CIで作成した同一成果物に基づく検証を優先する。Production未公開の段階ではこのコマンドをProductionへ実行したと記載しない。
