import { KeyboardEvent, useRef, useEffect } from 'react';

interface TabContainerProps {
  activeTab: 'mask' | 'unmask';
  onChangeTab: (tab: 'mask' | 'unmask') => void;
}

export function TabContainer({ activeTab, onChangeTab }: TabContainerProps) {
  const maskTabRef = useRef<HTMLButtonElement>(null);
  const unmaskTabRef = useRef<HTMLButtonElement>(null);

  // 活性タブが切り替わったときにアクティブな要素へフォーカスを移す
  useEffect(() => {
    if (activeTab === 'mask') {
      maskTabRef.current?.focus();
    } else {
      unmaskTabRef.current?.focus();
    }
  }, [activeTab]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentTab: 'mask' | 'unmask') => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextTab = currentTab === 'mask' ? 'unmask' : 'mask';
      onChangeTab(nextTab);
    }
  };

  return (
    <div className="border-b border-brand-border/40">
      <div
        role="tablist"
        aria-label="処理モードの選択"
        className="flex space-x-1"
      >
        <button
          ref={maskTabRef}
          id="tab-mask"
          role="tab"
          aria-selected={activeTab === 'mask'}
          aria-controls="panel-mask"
          tabIndex={activeTab === 'mask' ? 0 : -1}
          onClick={() => onChangeTab('mask')}
          onKeyDown={(e) => handleKeyDown(e, 'mask')}
          className={`px-6 py-3.5 text-sm font-semibold rounded-t-lg transition-all duration-200 border-b-2 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 ${
            activeTab === 'mask'
              ? 'border-brand-primary text-brand-primary bg-brand-surface/40'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-brand-surface/10'
          }`}
        >
          仮名化 (Mask)
        </button>
        <button
          ref={unmaskTabRef}
          id="tab-unmask"
          role="tab"
          aria-selected={activeTab === 'unmask'}
          aria-controls="panel-unmask"
          tabIndex={activeTab === 'unmask' ? 0 : -1}
          onClick={() => onChangeTab('unmask')}
          onKeyDown={(e) => handleKeyDown(e, 'unmask')}
          className={`px-6 py-3.5 text-sm font-semibold rounded-t-lg transition-all duration-200 border-b-2 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 ${
            activeTab === 'unmask'
              ? 'border-brand-primary text-brand-primary bg-brand-surface/40'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-brand-surface/10'
          }`}
        >
          元データ復元 (Unmask)
        </button>
      </div>
    </div>
  );
}
