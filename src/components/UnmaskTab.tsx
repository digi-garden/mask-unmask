import { useState, useRef, useEffect, useTransition } from 'react';
import { MappingItem, unmaskText } from '../utils/maskEngine';

interface UnmaskTabProps {
  value: string;
  inputText: string;
  onChangeInputText: (text: string) => void;
  mappings: MappingItem[];
  showToast: (message: string) => void;
  onNavigate: (path: string) => void;
}

export function UnmaskTab({
  value,
  inputText,
  onChangeInputText,
  mappings,
  showToast,
  onNavigate
}: UnmaskTabProps) {
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const expectedScrollRef = useRef<{ element: HTMLTextAreaElement; top: number } | null>(null);

  // 復元出力結果
  const [unmaskedOutput, setUnmaskedOutput] = useState('');
  const [restoreCount, setRestoreCount] = useState(0);
  const [unrestoredTags, setUnrestoredTags] = useState<string[]>([]);

  // 1. 復元処理の自動実行
  useEffect(() => {
    startTransition(() => {
      const { unmaskedText, restoreCount: count, unrestoredTags: tags } = unmaskText(
        inputText,
        mappings
      );
      setUnmaskedOutput(unmaskedText);
      setRestoreCount(count);
      setUnrestoredTags(tags);
    });
  }, [inputText, mappings]);

  // 2. コピー処理 & フォールバック
  const handleCopyToClipboard = async () => {
    if (!unmaskedOutput) return;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(unmaskedOutput);
        showToast('復元テキストをクリップボードにコピーしました');
      } else {
        throw new Error('Clipboard API is not available');
      }
    } catch (err) {
      showToast('クリップボードへのアクセスに失敗しました。表示されたテキストを手動でコピーしてください。');
      if (outputRef.current) {
        outputRef.current.focus();
        outputRef.current.select();
      }
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const source = e.currentTarget;
    const target = source === inputRef.current ? outputRef.current : inputRef.current;
    if (!target) return;

    // プログラムによるスクロール同期の逆流を防ぐガード (指摘1 & エッジケース対応)
    const expected = expectedScrollRef.current;
    if (expected && expected.element === source && expected.top === source.scrollTop) {
      expectedScrollRef.current = null;
      return;
    }

    // 最大スクロール可能距離を算出
    const sourceMaxScroll = source.scrollHeight - source.clientHeight;
    const targetMaxScroll = target.scrollHeight - target.clientHeight;

    if (sourceMaxScroll <= 0 || targetMaxScroll <= 0) return;

    // スクロールの割合 (0.0 〜 1.0) を算出
    const scrollRatio = source.scrollTop / sourceMaxScroll;

    // その割合をターゲットに適用して scrollTop を同期
    const nextScrollTop = Math.round(scrollRatio * targetMaxScroll);
    if (target.scrollTop !== nextScrollTop) {
      expectedScrollRef.current = {
        element: target,
        top: nextScrollTop
      };
      target.scrollTop = nextScrollTop;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 安全性とプライバシーに関する短い案内 */}
      <div className="text-sm text-slate-400 bg-brand-surface/20 border border-brand-border/20 px-4 py-3 rounded-lg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <span>仮名化・復元処理はブラウザ内で行われ、入力内容を外部へ送信するアプリケーション処理はありません。</span>
        <a
          href="/safety-and-privacy"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/safety-and-privacy');
          }}
          className="text-brand-primary underline hover:text-brand-primaryHover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded px-1 shrink-0 text-xs font-semibold"
        >
          安全性とプライバシーについて詳しく見る
        </a>
      </div>

      {/* 2カラムレイアウト */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 左カラム: 復元元の入力 */}
        <div className="flex flex-col gap-2 relative h-[480px]">
          <div className="flex justify-between items-center h-8">
            <label htmlFor="unmask-input" className="text-sm font-semibold text-slate-300">
              復元元の入力テキスト (仮名化タグを含むテキスト)
            </label>
          </div>
          <textarea
            ref={inputRef}
            id="unmask-input"
            value={value}
            onChange={(e) => onChangeInputText(e.target.value)}
            onScroll={handleScroll}
            placeholder="仮名化タグを含むテキスト（例: User [CN_EMAIL_0001] connected...）を入力してください..."
            className="w-full h-[calc(100%-2rem)] bg-brand-input border border-brand-border/40 hover:border-brand-border rounded-lg p-4 text-slate-100 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition duration-200 resize-none"
          />
        </div>

        {/* 右カラム: 復元出力 */}
        <div className="flex flex-col gap-2 relative h-[480px]">
          <div className="flex justify-between items-center h-8">
            <label htmlFor="unmask-output" className="text-sm font-semibold text-slate-300">
              復元後の出力テキスト
            </label>
            <div className="flex items-center gap-2">
              {isPending && (
                <span className="text-xs text-brand-primary flex items-center gap-1 animate-pulse mr-2">
                  処理中...
                </span>
              )}
              <button
                disabled={!unmaskedOutput}
                onClick={handleCopyToClipboard}
                className="px-3 py-1.5 text-xs bg-brand-primary disabled:bg-brand-primary/30 disabled:text-white/70 hover:bg-brand-primaryHover text-emerald-950 rounded-lg font-extrabold tracking-wide shadow-md shadow-brand-primary/10 hover:shadow-brand-primary/20 disabled:shadow-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                コピー (Copy)
              </button>
            </div>
          </div>
          <textarea
            ref={outputRef}
            id="unmask-output"
            value={unmaskedOutput}
            readOnly
            onScroll={handleScroll}
            placeholder="復元結果がここに表示されます..."
            className="w-full h-[calc(100%-2rem)] bg-brand-input/60 border border-brand-border/30 rounded-lg p-4 text-slate-300 text-sm leading-relaxed focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* 下部: 復元サマリーパネル */}
      <div className="bg-brand-surface/40 border border-brand-border/30 rounded-xl p-5 flex flex-col gap-4">
        <h3 className="text-sm font-bold text-slate-200">復元処理サマリー</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* 復元成功数 */}
          <div className="bg-brand-card/20 border border-brand-border/10 rounded-lg p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400">正常復元された一意のタグ数</span>
            <span className="text-2xl font-bold text-brand-primary mt-2">
              {restoreCount} 件
            </span>
          </div>

          {/* 未復元タグリスト */}
          <div className="bg-brand-card/20 border border-brand-border/10 rounded-lg p-4 flex flex-col gap-2">
            <span className="text-xs text-slate-400">
              置換マップに存在しない未復元タグ ({unrestoredTags.length} 件)
            </span>
            <div className="overflow-y-auto max-h-24 flex flex-wrap gap-1.5 mt-2">
              {unrestoredTags.length === 0 ? (
                <span className="text-xs text-slate-500 italic">未復元タグはありません</span>
              ) : (
                unrestoredTags.map(tag => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 bg-brand-danger/10 border border-brand-danger/30 text-brand-danger rounded-md font-mono text-[10px]"
                  >
                    {tag}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
