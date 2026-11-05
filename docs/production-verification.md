# MU-COMP-003 本番環境のHTTP・CSP検証

## 目的と位置付け

Mask & Unmaskの**デプロイ済み本番環境**で、HTTPレスポンスが期待するセキュリティヘッダーと公開ページを返すか確認する。ビルド時の`dist/_headers`検査や、ローカルのPlaywright E2Eとは別の検証である。

本手順は**読み取り専用**。送信するのは公開ページへのHTTP GETだけであり、仮名化対象テキスト、業務データ、認証情報は送信しない。

## 実行

```bash
npm run verify:production
# 別の本番オリジンで検証する場合
MU_PRODUCTION_ORIGIN=https://circle-note.com npm run verify:production
```

Node.js 20以上の`fetch`を使用。外部パッケージの追加は不要。検証失敗時は終了コード1となる。ネットワーク到達不能の場合は**失敗（要調査）**であり、アプリの不具合と即断しない。

## 自動検査項目

1. `/mask-unmask/` のHTTPS/HTTP 2xx、HTML、製品タイトル。
2. 本番レスポンスのCSPに`connect-src 'none'`、`object-src 'none'`、`frame-ancestors 'none'`が含まれること。
3. 本番レスポンスに`X-Content-Type-Options: nosniff`と`Referrer-Policy: no-referrer`があること。
4. `/mask-unmask`から`/mask-unmask/`への301。
5. `/mask-unmask/safety-and-privacy`への直接GETが成功すること。
6. `https://digi-garden.com/terms/`と`https://digi-garden.com/privacy/`がHTTPSでHTMLとして取得できること。

**制限:** この検査はブラウザ内の通信が本当に発生しないこと、JavaScript実行、法務ページ本文の妥当性、TLS設定全体、レスポンスヘッダーの全パス適用、Lighthouse指標までは証明しない。CIの通常PR実行には組み込まず、公開環境が安定している時点で実行する。

## 手動ブラウザ検証（リリース前）

- ChromeのDevTools → NetworkでPreserve logを有効化し、アプリを開いてテスト用の架空テキストだけでMask/Unmask、クリア、JSONエクスポートを行う。
- 通常操作時に意図しない外部通信が発生しないことを確認する。初期ページ表示に必要なHTML/JS/CSS取得、およびクリックした外部リンク遷移は別扱い。
- DevTools → Network → DocumentのレスポンスヘッダーでCSPを確認し、ConsoleのCSP違反を確認する。
- `/mask-unmask/safety-and-privacy`の直接表示・リロード、利用規約・プライバシーポリシーの内容・リンク切れを確認する。
- HTTP検証スクリプトと手動ブラウザの結果は、実行日時（JST）、対象URL、コミットSHA、実行者、検証結果、障害時の切り分け内容とともにリリース記録へ残す。Cookie、セッションID、入力実データは記録しない。

## 判定

全自動検査と手動ブラウザ検証に成功し証跡を保存できるまで、MU-COMP-003は**Not Verified**のままとする。失敗があれば原因を調査して、デプロイ・ホスト側設定・アプリ実装のいずれかへ切り分ける。
