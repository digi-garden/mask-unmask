# CircleNote Phase 5 — 本番切替前のステージングブラウザ総合テスト

## 実行条件
- ステージングWorker `https://circle-note-router-staging.masato-okada.workers.dev` が最新の独立Pages Originを参照していること
- `main` を参照する本番Pagesや `circle-note.com` のルーティングは変更しない
- 架空のテストデータのみ使用する（個人・業務データを入力しない）
- `npx playwright install chromium` の実行環境

## 実行（WSL）
```bash
cd ~/mask-unmask-public
git pull --ff-only origin main
npm ci
npx playwright install chromium
npm run test:phase5
```

ローカルの `dist` やVite previewではなく、実際の外部ステージングWorkerをChromiumで操作する。設定ファイルが `circle-note-router-staging.*.workers.dev` 以外を拒否するので、誤って本番へ試験データを入力しない。

## 受け入れ条件
1. PortalからMaskアプリへ同一originで遷移
2. Mask/Unmask/JSON exportでアプリ読み込み完了後の追加HTTP(S)なし
3. 安全性ページを深いURLで直接開いて200、再読み込み/アプリへの復帰
4. VRAM Calculatorで入力変更に伴い結果が変化し、リセットできる
5. Context-Packerが503かつno-store
6. ブラウザJS例外、console error、失敗リクエスト、CSP違反がない
7. Router HTTP smoke 30件以上、Router typecheck/unit、Mask側既存回帰とGitHub Actions成功

注：`test:phase5` はリモートのステージング依存であるため、標準 `npm run test:e2e` やPR CIには自動組み込みしない。公開URLのテストを本番へ向けて実行してはならない。

## 本番切替判定の追加要件
- Workerのproduction route、DNS/Custom Domainの具体的な反映方法を事前に確認
- 旧Mask Pagesへの切戻しとWorkerの無効化手順を文書化
- 本番への切替操作はPhase 6の承認後に限定する
- Context-Packerは公開後に別途統合する
