interface SafetyPrivacyProps {
  onNavigate: (path: string) => void;
}

export function SafetyPrivacy({ onNavigate }: SafetyPrivacyProps) {
  return (
    <div className="flex flex-col gap-6 animate-fadeIn text-slate-300">
      {/* パンくずリスト・戻る導線 */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <button
          onClick={() => onNavigate('/')}
          className="hover:text-brand-primary hover:underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          ホーム
        </button>
        <span>&gt;</span>
        <span className="text-slate-200 font-medium">安全性とプライバシー</span>
      </div>

      <div className="bg-brand-surface/20 border border-brand-border/20 rounded-2xl p-6 md:p-8 shadow-xl space-y-8">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight border-b border-brand-border/30 pb-3">
            安全性とプライバシーについて
          </h2>
          <p className="text-sm text-slate-300 mt-4 leading-relaxed">
            Mask &amp; Unmask（以下「本ツール」）は、利用者の機密情報の安全な仮名化および復元をサポートするツールです。本ページでは、ツールの処理、データの保存、および通信に関する技術的な仕様と利用上の注意点について説明します。
          </p>
        </div>

        {/* 1. ブラウザ内での処理 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-brand-primary flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            1. ブラウザ内での処理
          </h3>
          <div className="text-sm text-slate-300 space-y-2 leading-relaxed pl-7">
            <p>
              本ツールには、入力テキストや置換マップを外部へ送信するアプリケーション処理はありません。仮名化および復元処理は、すべてご利用のブラウザ内で実行されます。
            </p>
            <p className="text-slate-400 text-xs">
              ※本ツールは、利用者がソースコードや実際の処理内容を確認して利用できる構成となっています。処理の安全性を保証するものではありません。
            </p>
          </div>
        </section>

        {/* 2. データの保存 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-brand-primary flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4" />
            </svg>
            2. データの保存
          </h3>
          <div className="text-sm text-slate-300 space-y-2 leading-relaxed pl-7">
            <p>
              入力内容や置換マップは、同じタブ内での作業継続を目的として <code className="bg-brand-input px-1.5 py-0.5 rounded text-xs text-brand-primary">sessionStorage</code> に一時保存されます。ページを再読み込みしても同じタブのセッション中は保持され、通常はタブを閉じると消去されます。
            </p>
            <p>
              ただし、ブラウザのセッション復元機能などにより状態が復元される場合があります。消去を完全には保証するものではありません。また、本アプリでは Cookie、<code className="bg-brand-input px-1.5 py-0.5 rounded text-xs text-brand-primary">localStorage</code>、IndexedDB などの永続的な保存領域は使用していません。
            </p>
          </div>
        </section>

        {/* 3. 通信と外部サービス */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-brand-primary flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h2a2.5 2.5 0 002.5-2.5V14a2 2 0 00-2-2h-.5A2.5 2.5 0 0114 9.5V7a2 2 0 00-2-2h-.5a3.99 3.99 0 00-3 1.354" />
            </svg>
            3. 通信と外部サービス
          </h3>
          <div className="text-sm text-slate-300 space-y-2 leading-relaxed pl-7">
            <p>
              アプリの読み込み完了後、仮名化、復元、コピー、JSON形式のインポートやエクスポートなどの通常操作において、アプリが外部への通信を開始することはありません。
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 ml-1">
              <li>第三者広告の掲載はありません。</li>
              <li>外部アクセス解析ツール（Google Analytics等）は導入していません。</li>
              <li>外部スクリプト、外部フォント（Google Fonts等）、外部CDNの読み込みは行いません。</li>
            </ul>
            <p className="text-slate-400 text-xs mt-2">
              ※ページを表示する際には、HTML、JavaScript、CSSなどを取得するため、通常のWebアクセスがホスティング基盤へ発生します。また、利用者が「デジガーデン」などの外部リンクをクリックした場合は、リンク先へ接続するための通信が発生します。
            </p>
          </div>
        </section>

        {/* 4. エクスポートデータの注意 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-brand-primary flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            4. エクスポートデータの注意
          </h3>
          <div className="text-sm text-slate-300 space-y-2 leading-relaxed pl-7">
            <p>
              エクスポートされたJSONファイルには、置換マップの <code className="bg-brand-input px-1.5 py-0.5 rounded text-xs text-brand-primary">original</code> 値として元の文字列が平文（暗号化されていないテキスト）で含まれます。元の情報を推測または復元できる可能性があるため、機密データとして安全に管理してください。
            </p>
            <div className="bg-brand-surface/40 p-4 rounded-xl border border-brand-border/20 space-y-2 text-xs text-slate-300 mt-2">
              <p className="font-semibold text-slate-200">【安全な取り扱いのための注意事項】</p>
              <ul className="list-decimal list-inside space-y-1 ml-1">
                <li>エクスポートファイルはパスワード保護されたフォルダなど、安全な場所に保存してください。</li>
                <li>メールやメッセージアプリ等で、第三者へ不用意に共有・送信しないでください。</li>
                <li>クラウドストレージ等へ保存する場合は、そのサービスの利用規程と公開範囲設定（非公開になっているか等）を必ず確認してください。</li>
                <li>不要になったファイルは、ゴミ箱から完全に削除するなど適切に削除してください。</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 5. 利用上の注意 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-brand-primary flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            5. 利用上の注意
          </h3>
          <div className="text-sm text-slate-300 space-y-2 leading-relaxed pl-7">
            <ul className="list-disc list-inside space-y-1">
              <li>自動検出機能は特定のパターン（正規表現等）にマッチする情報を機械的に検出するものであり、すべての機密情報を完全に検出できるとは限りません。</li>
              <li>変換結果に機密情報が残っていないか、最終的には必ず利用者自身で目視確認してください。</li>
              <li>所属する企業・団体のセキュリティ規程、および適用される個人情報保護法等の関連法令に従ってご利用ください。</li>
              <li>本ページは本ツールの技術的な処理とデータの扱いを説明するものであり、正式な免責事項（利用規約や免責規定等）は別途整備予定です。</li>
            </ul>
          </div>
        </section>

        {/* 6. 提供元情報とプライバシーポリシー */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-brand-primary flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            6. 提供元情報とプライバシーポリシー
          </h3>
          <div className="text-sm text-slate-300 space-y-2 leading-relaxed pl-7">
            <p>
              本ツールは「デジガーデン」によって開発・提供されています。デジガーデン全体の個人情報保護方針につきましては、以下のリンクよりプライバシーポリシーをご確認ください。
            </p>
            <p className="mt-2">
              <a
                href="https://digi-garden.com/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-primary underline hover:text-brand-primaryHover transition"
              >
                <span>デジガーデン プライバシーポリシー</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </p>
          </div>
        </section>

        {/* アプリに戻るボタン */}
        <div className="pt-6 border-t border-brand-border/20 flex justify-center">
          <button
            onClick={() => onNavigate('/')}
            className="px-8 py-3 bg-brand-primary hover:bg-brand-primaryHover text-emerald-950 font-extrabold rounded-lg tracking-wide shadow-md shadow-brand-primary/10 hover:shadow-brand-primary/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
          >
            ツールに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
