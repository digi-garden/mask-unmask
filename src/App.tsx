import { useState, useEffect } from 'react';
import { usePersistedState } from './hooks/usePersistedState';
import { TabContainer } from './components/TabContainer';
import { MaskTab } from './components/MaskTab';
import { UnmaskTab } from './components/UnmaskTab';
import { CommonActions } from './components/CommonActions';
import { MappingItem, syncMappings } from './utils/maskEngine';
import { SafetyPrivacy } from './components/SafetyPrivacy';
import {
  APP_BASE_PATH,
  APP_HOME_PATH,
  APP_PUBLIC_ASSET_BASE,
  PRIVACY_PATH,
  normalizeAppPath,
} from './paths';

export default function App() {
  // 原子的セッション永続化フックのバインド
  const [state, setState, clearState] = usePersistedState();

  // 簡易ルーティング管理
  const [currentPath, setCurrentPath] = useState(() => normalizeAppPath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(normalizeAppPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // パスの正規化リダイレクト / 不明なパスに対するトップフォールバック
  useEffect(() => {
    const allowedPaths = [APP_BASE_PATH, PRIVACY_PATH];
    if (!allowedPaths.includes(currentPath)) {
      window.history.replaceState(null, '', APP_HOME_PATH);
      setCurrentPath(APP_BASE_PATH);
    } else {
      // 許可されたパスであっても、実際のブラウザURL（pathname）が正規化されていない場合は同期
      const currentUrlPath = window.location.pathname;
      const canonicalPath = currentPath === APP_BASE_PATH ? APP_HOME_PATH : currentPath;
      if (currentUrlPath !== canonicalPath) {
        window.history.replaceState(null, '', canonicalPath);
      }
    }
  }, [currentPath]);

  const navigateTo = (path: string) => {
    const normalized = normalizeAppPath(path);
    const targetPath = normalized === APP_BASE_PATH ? APP_HOME_PATH : normalized;
    window.history.pushState(null, '', targetPath);
    setCurrentPath(normalized);
  };

  // キー入力時のバースト防止用の即時入力テキストステート (指摘3)
  const [maskInput, setMaskInput] = useState(state.maskInput);
  const [unmaskInput, setUnmaskInput] = useState(state.unmaskInput);

  // 初期ロード時やクリアリセット時の親 state 同期
  useEffect(() => {
    setMaskInput(state.maskInput);
  }, [state.maskInput]);

  useEffect(() => {
    setUnmaskInput(state.unmaskInput);
  }, [state.unmaskInput]);

  // 一時除外リストの状態管理 (UIライフサイクル用)
  const [excludeList, setExcludeList] = useState<string[]>([]);

  // トースト状態
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // トースト表示自動消去タイマー
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  // 状態の安全な更新と容量超過等のエラーハンドリングを統一するヘルパー (指摘4)
  const updateStateHelper = (
    updater: (prev: typeof state) => typeof state
  ): boolean => {
    const { success, error } = setState(updater);
    if (!success && error) {
      if (error.name === 'QuotaExceededError') {
        showToast('エラー: セッションストレージ容量制限を超えたため、設定を保存できませんでした。');
      } else {
        showToast('エラー: データの保存に失敗しました。');
      }
      return false;
    }
    return success;
  };

  // maskInput の 500ms debounce 同期効果 (入力から消えたAUTOマップの即時同期削除も含む - 指格1,3,5)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (maskInput !== state.maskInput) {
        const success = updateStateHelper(prev => {
          const nextMappings = syncMappings(maskInput, prev.mappings, prev.detectionToggles);
          return {
            ...prev,
            maskInput: maskInput,
            mappings: nextMappings
          };
        });
        if (!success) {
          // 保存に失敗した場合、表示用Stateをロールバック (指摘2)
          setMaskInput(state.maskInput);
        }
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [maskInput, state.maskInput]);

  // unmaskInput の 500ms debounce 同期効果 (指摘3)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (unmaskInput !== state.unmaskInput) {
        const success = updateStateHelper(prev => ({ ...prev, unmaskInput: unmaskInput }));
        if (!success) {
          // 保存に失敗した場合、表示用Stateをロールバック (指摘2)
          setUnmaskInput(state.unmaskInput);
        }
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [unmaskInput, state.unmaskInput]);

  // 1. 各種入力や設定変更時の React State 更新と storage 同期
  const handleMaskInput = (text: string) => {
    setMaskInput(text);
  };

  const handleUnmaskInput = (text: string) => {
    setUnmaskInput(text);
  };

  const handleChangeTab = (tab: 'mask' | 'unmask') => {
    updateStateHelper(prev => ({ ...prev, activeTab: tab }));
  };

  const handleChangeToggles = (toggles: Record<'APIKEY' | 'IPV4' | 'IPV6' | 'EMAIL' | 'PHONE', boolean>) => {
    updateStateHelper(prev => {
      const nextMappings = syncMappings(maskInput, prev.mappings, toggles);
      return {
        ...prev,
        detectionToggles: toggles,
        mappings: nextMappings
      };
    });
  };

  // 置換マップの追加・削除更新
  const handleUpdateMappings = (newMappings: MappingItem[]): boolean => {
    return updateStateHelper(prev => ({ ...prev, mappings: newMappings }));
  };

  // 2. 共通クリア (リセット)
  const handleClearAll = () => {
    const { success } = clearState();
    if (success) {
      setMaskInput('');
      setUnmaskInput('');
      setExcludeList([]);
      showToast('すべてのデータと置換マップを消去しました');
    } else {
      showToast('エラー: データの消去に失敗しました。');
    }
  };

  // 3. インポートマッピングの適用 (保存成否を呼び出し元へ通知 - 指格4)
  const handleImportMappings = (importedMappings: MappingItem[]): boolean => {
    return handleUpdateMappings(importedMappings);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100 flex flex-col">
      {/* ヘッダー領域 */}
      <header className="border-b border-brand-border/30 bg-brand-surface/60 backdrop-blur-md sticky top-0 z-10 px-4 py-4 md:px-8 flex justify-between items-center shadow-lg">
        <a
          href={APP_HOME_PATH}
          onClick={(e) => {
            e.preventDefault();
            navigateTo(APP_HOME_PATH);
          }}
          className="flex items-center gap-3 hover:opacity-80 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-lg p-0.5"
        >
          <svg className="w-8 h-8 text-brand-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight">Mask & Unmask</h1>
            <p className="text-[10px] text-slate-400">機密情報の仮名化・復元ツール</p>
          </div>
        </a>

        {/* セキュリティバッジ (文言の確定準拠 - 軽微指摘) */}
        <div className="flex items-center gap-2 bg-brand-primary/10 border border-brand-primary/30 px-3 py-1.5 rounded-full text-xs font-semibold text-brand-primary">
          <span className="w-2 h-2 rounded-full bg-brand-primary animate-ping" />
          入力データを送信しない / ブラウザ内完結
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6">
        {currentPath === PRIVACY_PATH ? (
          <SafetyPrivacy onNavigate={navigateTo} />
        ) : (
          <>
            {/* タブコンテナ */}
            <TabContainer
              activeTab={state.activeTab}
              onChangeTab={handleChangeTab}
            />

            {/* 各種タブパネル */}
            <div className="bg-brand-surface/20 border border-brand-border/20 rounded-2xl p-6 shadow-xl relative min-h-[400px]">

              {/* 仮名化タブパネル */}
              <div
                id="panel-mask"
                role="tabpanel"
                aria-labelledby="tab-mask"
                hidden={state.activeTab !== 'mask'}
                className={state.activeTab === 'mask' ? 'block' : 'hidden'}
              >
                <MaskTab
                  value={maskInput}
                  inputText={state.maskInput}
                  onChangeInputText={handleMaskInput}
                  mappings={state.mappings}
                  onUpdateMappings={handleUpdateMappings}
                  toggles={state.detectionToggles}
                  onChangeToggles={handleChangeToggles}
                  excludeList={excludeList}
                  onUpdateExcludeList={setExcludeList}
                  showToast={showToast}
                  onNavigate={navigateTo}
                />
              </div>

              {/* 復元タブパネル */}
              <div
                id="panel-unmask"
                role="tabpanel"
                aria-labelledby="tab-unmask"
                hidden={state.activeTab !== 'unmask'}
                className={state.activeTab === 'unmask' ? 'block' : 'hidden'}
              >
                <UnmaskTab
                  value={unmaskInput}
                  inputText={state.unmaskInput}
                  onChangeInputText={handleUnmaskInput}
                  mappings={state.mappings}
                  showToast={showToast}
                  onNavigate={navigateTo}
                />
              </div>

            </div>

            {/* 共通操作パネル (インポート・エクスポート・共通クリア) */}
            <div className="mt-2">
              <CommonActions
                mappings={state.mappings}
                onImportMappings={handleImportMappings}
                onClearAll={handleClearAll}
                showToast={showToast}
              />
            </div>

            {/* 用途説明・最短手順・注意事項・FAQ (SEO-05) */}
            <section
              aria-labelledby="usage-guide-heading"
              className="mt-4 bg-brand-surface/15 border border-brand-border/20 rounded-2xl p-5 md:p-6 text-slate-300 space-y-5"
            >
              <h2 id="usage-guide-heading" className="text-base font-bold text-white tracking-tight">
                Mask &amp; Unmask の用途・使い方・よくある質問
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed">
                <div className="bg-brand-surface/30 border border-brand-border/20 rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-bold text-brand-primary">主な用途・使用例</h3>
                  <p>
                    生成AIへのプロンプト入力や障害ログ・問い合わせ文の共有前に、文章内のメールアドレス（EMAIL）・電話番号（PHONE）・IPアドレス（IPV4/IPV6）・認証トークン（APIKEY）や任意の固有名詞（CUSTOM）を一意の仮名化タグ（例: [CN_EMAIL_xxxx] 形式）へ置換し、AIの回答などを元の文字列へ復元できます。
                  </p>
                </div>

                <div className="bg-brand-surface/30 border border-brand-border/20 rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-bold text-brand-primary">最短の利用手順</h3>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>「仮名化 (Mask)」に文章を入力し、自動検出または手動追加（PC画面のドラッグ選択・直接入力）で置換内容と出力を確認してコピーします。</li>
                    <li>同じタブ内では「元データ復元 (Unmask)」にタグ付き文章を貼り付けるだけで元の文字列へ復元できます。</li>
                    <li>別タブや後日復元する場合は、事前にJSONとしてエクスポートし、復元時にインポートして利用します。</li>
                  </ol>
                </div>

                <div className="bg-brand-surface/30 border border-brand-border/20 rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-bold text-brand-primary">利用上の注意点</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>本ツールは置換マップで復元可能な「仮名化」を行うものであり、完全な匿名化ではありません。</li>
                    <li>自動検出は正規表現パターンに基づくため、すべての機密情報の検出を保証しません。共有前に必ず出力結果を目視確認してください。</li>
                    <li>エクスポートしたJSONファイルには元の文字列が平文で含まれるため、保管・共有の取り扱いにご注意ください。</li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-brand-border/20 pt-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-200">よくある質問（FAQ）</h3>
                <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed">
                  <div className="space-y-1">
                    <dt className="font-semibold text-slate-100">Q. 入力したテキストや置換マップはサーバーへ送信されますか？</dt>
                    <dd className="text-slate-400">
                      いいえ。仮名化・復元の処理はすべてご利用のブラウザ内で実行され、外部サーバーへ送信されません。作業状態は同一タブ内の <code className="font-mono text-slate-300">sessionStorage</code> にのみ一時保存されます。
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="font-semibold text-slate-100">Q. 氏名や社名など自動検出されない語句も仮名化できますか？</dt>
                    <dd className="text-slate-400">
                      はい。PC表示では入力テキストをドラッグ選択するか直接入力して追加登録することで、任意の文字列を仮名化タグ（[CN_CUSTOM_xxxx] 形式など）に置換できます。
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="font-semibold text-slate-100">Q. タブを閉じたあとに元のテキストへ復元するにはどうすればよいですか？</dt>
                    <dd className="text-slate-400">
                      タブを閉じると一時保存データは消去されるため、事前に置換マップをJSONファイルとしてエクスポートして安全に保管してください。復元時にインポートすると元の文字列へ復元できます。
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          </>
        )}
      </main>

      {/* フッター */}
      <footer className="border-t border-brand-border/20 py-4 text-center text-slate-400 text-xs">
        <p>&copy; 2026 digi-garden</p>
        <p className="mt-1.5 flex flex-wrap justify-center items-center gap-3">
          <span className="flex items-center gap-2">
            <span>提供：</span>
            <a
              href="https://digi-garden.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="digi-garden（デジガーデン）のWebサイトを開く"
              className="inline-flex shrink-0 items-center rounded-md bg-identity-background px-2 py-1.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
            >
              <img
                src={`${APP_PUBLIC_ASSET_BASE}digi-garden-logo.svg`}
                alt="digi-garden（デジガーデン）"
                className="h-5 w-auto"
              />
            </a>
          </span>
          <span className="text-slate-700">|</span>
          <a
            href={PRIVACY_PATH}
            onClick={(e) => {
              e.preventDefault();
              navigateTo(PRIVACY_PATH);
            }}
            className="text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
          >
            安全性とプライバシー
          </a>
          <span className="text-slate-700">|</span>
          <a
            href={`${APP_PUBLIC_ASSET_BASE}third-party-licenses/README.md`}
            className="text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
          >
            OSSライセンス
          </a>
          <span className="text-slate-700">|</span>
          <a
            href="https://digi-garden.com/terms/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
          >
            利用規約
          </a>
          <span className="text-slate-700">|</span>
          <a
            href="https://digi-garden.com/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
          >
            プライバシーポリシー
          </a>
        </p>
      </footer>

      {/* トースト通知 (要求事項) */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-brand-surface border border-brand-primary/50 text-brand-primary text-sm font-semibold rounded-full shadow-2xl flex items-center gap-2 animate-bounce transition-all duration-300"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
