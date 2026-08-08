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
          </>
        )}
      </main>

      {/* フッター */}
      <footer className="border-t border-brand-border/20 py-4 text-center text-slate-500 text-xs">
        <p>&copy; 2026 digi-garden</p>
        <p className="mt-1.5 flex justify-center items-center gap-3">
          <span className="flex items-center gap-2">
            <span>提供：</span>
            <a
              href="https://digi-garden.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="digi-garden（デジガーデン）のWebサイトを開く"
              className="inline-flex rounded transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
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
