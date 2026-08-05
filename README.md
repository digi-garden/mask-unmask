# Mask & Unmask

ChatGPTやClaudeなどの生成AIへ文章・ログを渡す前に、機密情報をブラウザ内で仮名化し、AIの回答をあとから元の内容へ復元するWebツールです。

入力テキストや置換マップをサーバーへ送信せず、変換処理はブラウザ内で完結します。

> 公開URL：準備中

## 主な機能

### 仮名化（Mask）

入力テキストから次の情報をルールベースで検出し、固有タグへ置き換えます。

- APIキー
- IPv4アドレス
- IPv6アドレス
- メールアドレス
- 日本国内の電話番号
- ユーザーが指定したカスタム単語

変換例：

```text
連絡先は user@example.com です。
```

```text
連絡先は [CN_EMAIL_0001] です。
```

同じ値には同じタグを割り当て、既に仮名化されたタグの二重変換を防止します。

### 復元（Unmask）

生成AIから返された文章に含まれる仮名化タグを、保持している置換マップに基づいて元の値へ復元します。

復元件数と未復元タグも画面上で確認できます。

### 置換マップ管理

* 登録内容の確認と個別削除
* 置換マップと入力内容の一括クリア
* JSON形式でのエクスポート・インポート
* `sessionStorage`による同一タブ内での一時保持

エクスポートとインポート、カスタム単語登録はPC向け機能です。

## プライバシーと安全性

Mask & Unmaskには、ユーザー登録、ログイン、データベース、入力データを受信するバックエンドAPIはありません。

変換処理はブラウザ内で実行されます。外部フォントや外部CDNも使用しません。

ただし、利用時には次の点に注意してください。

* 自動検出はルールベースであり、すべての機密情報を検出できるとは限りません。
* 仮名化結果を生成AIへ送信する前に、未変換の機密情報が残っていないか必ず確認してください。
* データは`sessionStorage`へ一時保存されます。ブラウザのセッション復元やタブ複製によって残る場合があります。
* 利用後はアプリ内の一括クリアを実行してください。
* エクスポートしたJSONには元の機密情報が含まれます。安全に管理し、不要になったら削除してください。
* 本ツールの利用だけで、情報漏えい防止や法令・社内規程への適合が保証されるものではありません。

詳しい検証内容は以下を参照してください。

* [安全性・プライバシー検証](docs/safety_privacy_validation.md)
* [Lighthouse・CSP監査](docs/lighthouse_and_csp_audit.md)

## 対応環境

JavaScriptと`sessionStorage`が利用できる、現在サポートされている主要なWebブラウザを想定しています。

画面幅768px未満では、次の機能が制限されます。

* カスタム単語登録
* 置換マップのエクスポート・インポート

仮名化、復元、コピー、一括クリアは利用できます。

## ローカルでの実行

### 必要なもの

* Node.js
* npm

### セットアップ

```bash
git clone git@github-digi-garden:digi-garden/mask-unmask.git
cd mask-unmask
npm ci
```

通常のGitHub SSH接続を使用する場合は、環境に合わせてclone URLを変更してください。

### 開発サーバー

```bash
npm run dev
```

表示されたローカルURLをブラウザで開いてください。

### 本番ビルド

```bash
npm run build
npm run preview
```

生成物は`dist`ディレクトリへ出力されます。

## テスト

型チェック：

```bash
npm run type-check
```

単体・コンポーネントテスト：

```bash
npm run test
```

性能テスト：

```bash
npm run test:perf
```

E2Eテスト：

```bash
npx playwright install
CI=true npm run test:e2e
```

依存パッケージの監査：

```bash
npm audit
```

## 採用技術

* React
* TypeScript
* Vite
* Tailwind CSS
* Vitest
* Testing Library
* Playwright

## ドキュメント

* [要件定義書](docs/requirements.md)
* [基本設計書](docs/basic_design.md)
* [実装計画](docs/implementation_plan.md)
* [ワイヤーフレーム](docs/wireframe.md)

## コントリビューション

不具合報告や改善提案は、GitHub Issuesからお知らせください。

セキュリティ上の問題を報告する場合は、APIキー、個人情報、実際の業務データなどをIssueへ掲載しないでください。

## ライセンス

このプロジェクトは[MIT License](LICENSE)のもとで公開されています。

Copyright (c) 2026 digi-garden
