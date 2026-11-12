# CircleNote Phase 4: Mask & Unmask独立Pages配信（移行候補）

## 状態
本書と実装は `feature/circle-note-standalone-pages` 上の提案。**本番切替承認ではない**。

## 判断
現行のアプリは `/mask-unmask/` を前提に、Vite `base`、React Router相当の内部パス、SEO、監査/E2Eが構築されている。配信元だけ独立させ、ブラウザに見える公開URLは維持する。

### ビルドモード
- `npm run build`: 従来どおり `dist/` に旧Portal + /mask-unmask/ を生成。既存本番の継続に使用する。
- `npm run build:standalone`: 従来ビルドと監査を通した後、`dist-standalone/` に**アプリのみ**をコピー。旧ポータル/robots/sitemapは含めない。
- standaloneのトップ `/` は意図的にアプリのトップとして使用しない。アプリは `/mask-unmask/` で提供する。
- Router Workerは現行の `rewrite: 'preserve'` を継続する。Phase 4で `strip` へ変更しない。
- `/mask-unmask` → `/mask-unmask/` は公開Workerで308。Pages単体では301。
- `/mask-unmask/safety-and-privacy` はPagesの200 rewriteでSPA HTMLを返す。

## Pagesの導入方法
既存 `mask-unmask.pages.dev` をこの時点で上書きしない。**別の独立検証用Pagesプロジェクト**を同じGitHubリポジトリから構築し、build command `npm run build:standalone`、output directory `dist-standalone`、branchはこの専用ブランチを指定する。

GitHub PR検証と `npm run build:standalone`、`node scripts/verify-standalone.mjs`、ブラウザ/HTTP統合テストが完了するまではRouterのMaskオリジンを変更しない。

## 必須検証
1. 既存 `npm run build` の出力、SEO/CSP、第三者ライセンス、監査、ユニット、E2Eが退行しない。
2. standaloneの `/` に旧Portal HTMLが存在しない。
3. standaloneの `/mask-unmask/` のHTML/JS/CSS/favicon/ライセンスファイルが200。
4. `/mask-unmask/safety-and-privacy` 直リンク・リロードで正しいアプリ画面。
5. Mask/Unmask、JSONエクスポート/インポート、sessionStorage、CSP、外部通信禁止のE2Eが成功。
6. staging Workerの Mask のオリジンを**検証用Pages URL**へ変更し、HTTP・Playwright検証成功。
7. バージョン/コミット固定、切戻し（旧 `mask-unmask.pages.dev` に戻す）を確認。
8. Phase 6で本番Router切替を承認するまでは `circle-note.com` の設定を変更しない。

## 運用注意
デフォルトブランチ `main` の既存Pagesへの自動デプロイを考慮し、PRをマージしても既存のビルドコマンドを変更しない。旧ポータル生成は本番切替完了後の別PRで除去する。
