export const DEMO_INPUT = `以下の進捗連絡を、内容を変えずに丁寧で自然なビジネスメールに書き直してください。

株式会社みらいサンプル
山田太郎様

お世話になっております。在庫管理画面の開発担当です。

商品コード検索と絞り込み機能が完成し、現在は動作確認中です。
確認用画面を8月19日までにお送りします。Excel出力は次回リリースで対応予定です。

ご質問は sato@example.com または 03-1234-5678 までお願いします。`;

export const GEMINI_FIXED_RESPONSE = `[CN_CUSTOM_0001]
[CN_CUSTOM_0002] 様

お世話になっております。在庫管理画面の開発担当です。

開発の進捗につきましてご連絡いたします。

商品コード検索と絞り込み機能が完成し、現在は動作確認を進めております。
確認用画面は8月19日までにお送りいたします。
なお、Excel出力につきましては次回リリースでの対応を予定しております。

ご質問などがございましたら、[CN_EMAIL_0001] または [CN_PHONE_0001] までご連絡いただけますと幸いです。

引き続き、よろしくお願いいたします。`;

export const EXPECTED_MAPPINGS = [
  ['[CN_CUSTOM_0001]', '株式会社みらいサンプル'],
  ['[CN_CUSTOM_0002]', '山田太郎'],
  ['[CN_EMAIL_0001]', 'sato@example.com'],
  ['[CN_PHONE_0001]', '03-1234-5678'],
];

export const CAPTIONS = {
  start: '生成AIへ渡す前に、機密情報を仮名化',
  pasteSource: '文章を貼り付け',
  company: '会社名を選択して仮名化',
  person: '氏名を選択して仮名化',
  autoDetect: 'メールアドレスと電話番号を自動検出',
  maskedResult: '機密情報を仮名タグに置き換え',
  sendToAi: '仮名化した文章を生成AIへ',
  pasteAnswer: '生成AIの回答を貼り付け',
  restoredResult: '仮名タグを元の情報に復元',
  summary: '4件すべて正常に復元',
  closing: [
    '仮名化・復元はブラウザ内で完結',
    'Mask & Unmaskは入力内容を外部へ送信しません',
    'https://circle-note.com/mask-unmask/',
  ],
};
