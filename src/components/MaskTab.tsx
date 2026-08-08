import { useState, useRef, useEffect, useTransition } from 'react';
import { MappingItem, maskText } from '../utils/maskEngine';
import { PRIVACY_PATH } from '../paths';

interface MaskTabProps {
  value: string;
  inputText: string;
  onChangeInputText: (text: string) => void;
  mappings: MappingItem[];
  onUpdateMappings: (newMappings: MappingItem[]) => void;
  toggles: Record<'APIKEY' | 'IPV4' | 'IPV6' | 'EMAIL' | 'PHONE', boolean>;
  onChangeToggles: (toggles: Record<'APIKEY' | 'IPV4' | 'IPV6' | 'EMAIL' | 'PHONE', boolean>) => void;
  excludeList: string[];
  onUpdateExcludeList: (list: string[]) => void;
  showToast: (message: string) => void;
  onNavigate: (path: string) => void;
}

export function MaskTab({
  value,
  inputText,
  onChangeInputText,
  mappings,
  onUpdateMappings,
  toggles,
  onChangeToggles,
  excludeList,
  onUpdateExcludeList,
  showToast,
  onNavigate
}: MaskTabProps) {
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const expectedScrollRef = useRef<{ element: HTMLTextAreaElement; top: number } | null>(null);

  // カスタム単語追加用のフォーム状態
  const [customOriginal, setCustomOriginal] = useState('');
  const [customCategory, setCustomCategory] = useState<MappingItem['category']>('CUSTOM');

  // 仮名化出力結果
  const [maskedOutput, setMaskedOutput] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  // 1. 仮名化処理の実行
  // 入力テキスト、マッピング項目、トグル、除外リストのいずれかが変化した際に仮名化を実行
  useEffect(() => {
    startTransition(() => {
      const { maskedText, newMappings, hasExistingTags } = maskText(
        inputText,
        mappings,
        toggles,
        excludeList
      );
      setMaskedOutput(maskedText);

      if (hasExistingTags) {
        setWarningMessage('警告: 入力テキスト内に既に仮名化タグ（例: [CN_EMAIL_0001]）が含まれているため、仮名化処理が一時的に中断されました。該当タグを除去するか、テキストを修正してください。');
      } else {
        setWarningMessage('');
        // 新しく自動検出されたマッピングを元のマッピングに追加
        if (newMappings.length > 0) {
          onUpdateMappings([...mappings, ...newMappings]);
        }
      }
    });
  }, [inputText, mappings, toggles, excludeList]);

  // 2. テキストドラッグ選択時の取得 & 転記ロック処理 (要求事項1)
  const handleTextSelect = () => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // 逆ドラッグ選択や選択解除、および文字数が 1 以上 1000 以下の範囲内
    if (start !== end && start !== null && end !== null) {
      const selectStart = Math.min(start, end);
      const selectEnd = Math.max(start, end);
      const selectedText = textarea.value.slice(selectStart, selectEnd).trim();

      if (selectedText && selectedText.length <= 1000) {
        setCustomOriginal(selectedText);
      }
    }
  };

  // 3. 入力変更時の除外リストクリアのライフサイクル (要求事項7)
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChangeInputText(e.target.value);
    // UI側の一時除外ライフサイクル: 入力変更を検知した時点で除外リストをクリアする
    if (excludeList.length > 0) {
      onUpdateExcludeList([]);
    }
  };

  // 4. カスタム単語登録
  const handleAddCustomMapping = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOriginal = customOriginal.trim();

    if (!cleanOriginal) {
      showToast('登録するテキストを入力またはドラッグ選択してください');
      return;
    }

    if (cleanOriginal.length > 1000) {
      showToast('カスタム登録できるテキストは最大1000文字です');
      return;
    }

    // 重複チェック
    const isExist = mappings.some(m => m.original === cleanOriginal);
    if (isExist) {
      showToast('この単語はすでに登録されています');
      return;
    }

    // 新規タグアロケーション
    const currentNumbers = mappings
      .filter(m => m.category === customCategory)
      .map(m => {
        const match = m.tag.match(/_(\d{4})\]$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const maxNum = currentNumbers.length > 0 ? Math.max(...currentNumbers) : 0;
    const nextNum = maxNum + 1;

    if (nextNum > 9999) {
      showToast(`上限に達したため登録できません: ${customCategory}`);
      return;
    }

    const newTag = `[CN_${customCategory}_${nextNum.toString().padStart(4, '0')}]`;
    const newItem: MappingItem = {
      tag: newTag,
      original: cleanOriginal,
      category: customCategory,
      source: 'CUSTOM'
    };

    onUpdateMappings([...mappings, newItem]);
    showToast(`カスタムマッピング ${newTag} を追加しました`);
    setCustomOriginal('');
  };

  // 5. 個別削除と一時除外リストへの登録
  const handleDeleteMapping = (item: MappingItem) => {
    // 置換マップから削除
    const updated = mappings.filter(m => !(m.tag === item.tag && m.original === item.original));
    onUpdateMappings(updated);

    // 除外リストに登録 (入力テキスト変更まで再検出を防ぐ)
    if (!excludeList.includes(item.original)) {
      onUpdateExcludeList([...excludeList, item.original]);
    }
    showToast(`タグ ${item.tag} を一時除外リストに追加しました`);
  };

  // 6. 出力テキストコピー処理 & コピー失敗フォールバック
  const handleCopyToClipboard = async () => {
    if (!maskedOutput) return;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(maskedOutput);
        showToast('仮名化テキストをクリップボードにコピーしました');
      } else {
        throw new Error('Clipboard API is not available');
      }
    } catch (err) {
      // コピー失敗時のフォールバック処理 (要求事項3)
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

  const handleToggle = (key: keyof typeof toggles) => {
    onChangeToggles({
      ...toggles,
      [key]: !toggles[key]
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 警告表示 */}
      {warningMessage && (
        <div className="bg-brand-warning/10 border border-brand-warning/30 text-brand-warning p-4 rounded-lg text-sm leading-relaxed">
          {warningMessage}
        </div>
      )}

      {/* 安全性とプライバシーに関する短い案内 */}
      <div className="text-sm text-slate-400 bg-brand-surface/20 border border-brand-border/20 px-4 py-3 rounded-lg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <span>仮名化・復元処理はブラウザ内で行われ、入力内容を外部へ送信するアプリケーション処理はありません。</span>
        <a
          href={PRIVACY_PATH}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(PRIVACY_PATH);
          }}
          className="text-brand-primary underline hover:text-brand-primaryHover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded px-1 shrink-0 text-xs font-semibold"
        >
          安全性とプライバシーについて詳しく見る
        </a>
      </div>

      {/* 2カラムレイアウト (入力と出力のテキストエリアのみ) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 左カラム: 仮名化元の入力 */}
        <div className="flex flex-col gap-2 relative h-[480px]">
          <div className="flex justify-between items-center h-8">
            <label htmlFor="mask-input" className="text-sm font-semibold text-slate-300">
              仮名化元の入力テキスト
            </label>
          </div>
          <textarea
            ref={inputRef}
            id="mask-input"
            value={value}
            onChange={handleInputChange}
            onSelect={handleTextSelect}
            onScroll={handleScroll}
            placeholder="個人情報を含むテキストを入力してください（ドラッグ選択でカスタム登録可能）..."
            className="w-full h-[calc(100%-2rem)] bg-brand-input border border-brand-border/40 hover:border-brand-border rounded-lg p-4 text-slate-100 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition duration-200 resize-none"
          />
        </div>

        {/* 右カラム: 仮名化出力 */}
        <div className="flex flex-col gap-2 relative h-[480px]">
          <div className="flex justify-between items-center h-8">
            <label htmlFor="mask-output" className="text-sm font-semibold text-slate-300">
              仮名化後の出力テキスト
            </label>
            <div className="flex items-center gap-2">
              {isPending && (
                <span className="text-xs text-brand-primary flex items-center gap-1 animate-pulse mr-2">
                  処理中...
                </span>
              )}
              <button
                disabled={!maskedOutput}
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
            id="mask-output"
            value={maskedOutput}
            readOnly
            onScroll={handleScroll}
            placeholder="仮名化された結果がここに表示されます..."
            className="w-full h-[calc(100%-2rem)] bg-brand-input/60 border border-brand-border/30 rounded-lg p-4 text-slate-300 text-sm leading-relaxed focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* 自動検出トグルパネル - 2カラムの直下に配置し、横幅いっぱいを活用 */}
      <div className="bg-brand-surface/40 p-4 rounded-xl border border-brand-border/30 flex flex-col md:flex-row md:items-center gap-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
          自動検出カテゴリー
        </h3>
        <div className="flex flex-wrap gap-2.5">
          {(Object.keys(toggles) as Array<keyof typeof toggles>).map(key => (
            <label
              key={key}
              className="flex items-center gap-2.5 cursor-pointer select-none bg-brand-surface/60 px-3 py-1.5 rounded-lg border border-brand-border/20 hover:border-brand-primary/30 transition-all duration-200"
            >
              {/* キーボードフォーカス可能な隠しチェックボックス */}
              <input
                type="checkbox"
                checked={toggles[key]}
                onChange={() => handleToggle(key)}
                className="sr-only"
                aria-label={`${key} 自動検出トグル`}
              />
              {/* カスタムトグルデザイン */}
              <div
                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 focus-within:ring-2 focus-within:ring-brand-primary/50 ${
                  toggles[key] ? 'bg-brand-primary' : 'bg-brand-card'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${
                    toggles[key] ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span className="text-xs font-semibold text-slate-300">{key}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 下部: 置換マップ一覧 (PC・モバイル共用) & カスタム単語登録 (PC専用 - 指格2) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* 左側: カスタム登録フォーム (PC専用 - hidden md:flex) */}
        <div className="hidden md:flex md:col-span-1 bg-brand-surface/30 border border-brand-border/40 rounded-xl p-5 flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-200">カスタム単語登録</h3>
          <form onSubmit={handleAddCustomMapping} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="custom-original" className="text-xs text-slate-400">
                元のテキスト (ドラッグ選択または直接入力)
              </label>
              <input
                id="custom-original"
                type="text"
                value={customOriginal}
                onChange={(e) => setCustomOriginal(e.target.value)}
                placeholder="選択したテキストが入ります"
                className="w-full bg-brand-input border border-brand-border/40 hover:border-brand-border rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/45 focus:border-brand-primary transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="custom-category" className="text-xs text-slate-400">
                割り当てる機密カテゴリー
              </label>
              <select
                id="custom-category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as MappingItem['category'])}
                className="w-full bg-brand-input border border-brand-border/40 hover:border-brand-border rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/45 focus:border-brand-primary transition"
              >
                <option value="CUSTOM">CUSTOM (その他一般テキスト)</option>
                <option value="APIKEY">APIKEY (認証トークン)</option>
                <option value="IPV4">IPV4 (IPアドレス v4)</option>
                <option value="IPV6">IPV6 (IPアドレス v6)</option>
                <option value="EMAIL">EMAIL (電子メール)</option>
                <option value="PHONE">PHONE (電話番号)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2 bg-brand-surface hover:bg-brand-card border border-brand-primary/40 hover:border-brand-primary text-brand-primary rounded-lg text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            >
              登録を追加
            </button>
          </form>
        </div>

        {/* 右側: 置換マップ一覧 (モバイル・PC共用 - md:col-span-2) */}
        <div className="md:col-span-2 bg-brand-surface/30 border border-brand-border/40 rounded-xl p-5 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-200">
              置換マップ一覧 ({mappings.length} 件)
            </h3>
            {excludeList.length > 0 && (
              <span className="text-xs text-brand-warning">
                一時除外中: {excludeList.length} 件
              </span>
            )}
          </div>

          <div className="overflow-y-auto max-h-56 border border-brand-border/20 rounded-lg bg-brand-input/40">
            {mappings.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                現在、仮名化されたデータはありません
              </div>
            ) : (
              <>
                {/* 1. モバイル向けカード形式レイアウト (指摘3 & 5) */}
                <div className="block md:hidden space-y-3 p-3">
                  {mappings.map((item) => (
                    <div
                      key={item.tag + '-' + item.original}
                      className="bg-brand-surface/60 border border-brand-border/20 rounded-lg p-3 flex gap-3 items-center"
                    >
                      {/* 48px タッチ領域の削除ボタン */}
                      <button
                        onClick={() => handleDeleteMapping(item)}
                        className="text-brand-danger hover:text-red-400 w-12 h-12 flex items-center justify-center rounded hover:bg-brand-danger/10 transition shrink-0 text-base"
                        aria-label={`${item.tag} マッピングを削除`}
                      >
                        ✕
                      </button>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs font-bold text-brand-primary">{item.tag}</span>
                          <span className="px-1.5 py-0.5 rounded bg-brand-surface border border-brand-border/30 text-[9px] text-slate-400">
                            {item.category}
                          </span>
                        </div>
                        {/* 長い機密文字列の折り返し・横スクロール防止 */}
                        <div className="text-xs text-slate-300 font-mono break-all whitespace-pre-wrap leading-relaxed max-h-20 overflow-y-auto pr-1">
                          {item.original}
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-400">
                          <span>来歴: {item.source}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 2. PC向けテーブル形式レイアウト (hidden md:table) */}
                <table className="hidden md:table w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-brand-surface/80 text-slate-400 font-semibold border-b border-brand-border/20">
                      <th className="p-2.5 w-14 text-center">削除</th>
                      <th className="p-2.5">仮名化タグ</th>
                      <th className="p-2.5">元の生データ</th>
                      <th className="p-2.5">カテゴリー</th>
                      <th className="p-2.5">来歴</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((item) => (
                      <tr
                        key={item.tag + '-' + item.original}
                        className="border-b border-brand-border/10 hover:bg-brand-surface/20 text-slate-300"
                      >
                        <td className="p-0 text-center">
                          <button
                            onClick={() => handleDeleteMapping(item)}
                            className="text-brand-danger hover:text-red-400 w-12 h-12 flex items-center justify-center rounded hover:bg-brand-danger/10 transition mx-auto text-base"
                            aria-label={`${item.tag} マッピングを削除`}
                          >
                            ✕
                          </button>
                        </td>
                        <td className="p-2 font-mono text-brand-primary">{item.tag}</td>
                        {/* 折り返し・横スクロールの防止仕様 */}
                        <td className="p-2 font-mono break-all whitespace-pre-wrap max-w-xs" title={item.original}>
                          {item.original}
                        </td>
                        <td className="p-2">
                          <span className="px-2 py-0.5 rounded bg-brand-surface border border-brand-border/30 text-[10px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            item.source === 'AUTO'
                              ? 'bg-blue-900/40 text-blue-300'
                              : item.source === 'CUSTOM'
                              ? 'bg-purple-900/40 text-purple-300'
                              : 'bg-emerald-900/40 text-emerald-300'
                          }`}>
                            {item.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
