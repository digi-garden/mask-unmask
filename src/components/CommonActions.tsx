import { useRef, useState } from 'react';
import { MappingItem } from '../utils/maskEngine';
import { readMapFile, exportMapFile, revokeExportUrl, FileLoadResult } from '../utils/mapFileService';
import { mergeImportedMappings } from '../utils/validator';

interface CommonActionsProps {
  mappings: MappingItem[];
  onImportMappings: (newMappings: MappingItem[]) => boolean;
  onClearAll: () => void;
  showToast: (message: string) => void;
}

export function CommonActions({
  mappings,
  onImportMappings,
  onClearAll,
  showToast
}: CommonActionsProps) {
  const clearDialogRef = useRef<HTMLDialogElement>(null);
  const importDialogRef = useRef<HTMLDialogElement>(null);
  const exportDialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // インポート確認用のプレビュー状態
  const [previewData, setPreviewData] = useState<{
    createdAt: string;
    version: string;
    totalCount: number;
    skipCount: number;
    renumberedCount: number;
    resultMappings: MappingItem[];
  } | null>(null);

  // ESCキーや外側クリックで閉じる際のクリーンアップ用
  const closeClearDialog = () => clearDialogRef.current?.close();
  const closeImportDialog = () => {
    setPreviewData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    importDialogRef.current?.close();
  };
  const closeExportDialog = () => exportDialogRef.current?.close();

  // インポートファイルの読み込み処理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 500KB制限、UTF-8、JSON Schema検証の実行
      const parsed: FileLoadResult = await readMapFile(file);

      // マージシミュレーション
      const { merged, renumberedCount } = mergeImportedMappings(mappings, parsed.mappings);

      // 重複スキップ数の計算
      // 現在件数 + インポート件数 - マージ後件数 = スキップ件数
      const skipCount = (mappings.length + parsed.mappings.length) - merged.length;

      setPreviewData({
        createdAt: parsed.createdAt,
        version: parsed.version,
        totalCount: parsed.mappings.length,
        skipCount,
        renumberedCount,
        resultMappings: merged
      });

      // プレビューダイアログを表示
      importDialogRef.current?.showModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'ファイルのインポートに失敗しました');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // インポートの確定適用
  const confirmImport = () => {
    if (previewData) {
      const success = onImportMappings(previewData.resultMappings);
      if (success) {
        showToast(`マップをインポートしました (追加・更新: ${previewData.totalCount - previewData.skipCount}件, 衝突再採番: ${previewData.renumberedCount}件)`);
      }
    }
    closeImportDialog();
  };

  // エクスポート実行
  const handleExport = () => {
    if (mappings.length === 0) {
      showToast('エクスポートする置換マップがありません');
      return;
    }
    exportDialogRef.current?.showModal();
  };

  const confirmExport = () => {
    try {
      const { url, filename } = exportMapFile(mappings);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('置換マップのエクスポートをダウンロードしました');

      // メモリリーク防止のため時間差でrevoke
      setTimeout(() => {
        revokeExportUrl(url);
      }, 5000);
    } catch (e) {
      showToast('エクスポート処理に失敗しました');
    }
    closeExportDialog();
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full">
      {/* エクスポート・インポート操作パネル (PC専用) */}
      <div className="hidden md:flex gap-3 flex-1">
        <button
          onClick={handleExport}
          className="flex-1 px-4 py-3 bg-brand-surface border border-brand-border/40 hover:border-brand-primary/50 text-slate-200 hover:text-white rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          マップエクスポート
        </button>

        <label className="flex-1 cursor-pointer">
          <span className="w-full px-4 py-3 bg-brand-surface border border-brand-border/40 hover:border-brand-primary/50 text-slate-200 hover:text-white rounded-lg font-medium transition-all duration-200 focus-within:ring-2 focus-within:ring-brand-primary/40 flex items-center justify-center gap-2 text-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            マップインポート
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="マッピングファイルをインポート"
          />
        </label>
      </div>

      {/* 共通リセットボタン (PC/モバイル共用) */}
      <button
        onClick={() => clearDialogRef.current?.showModal()}
        className="w-full md:w-auto md:px-8 py-3 bg-brand-danger/10 border border-brand-danger/40 hover:bg-brand-danger/20 text-brand-danger hover:text-red-400 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-danger/40 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        共通クリア (リセット)
      </button>

      {/* 1. クリア確認ダイアログ */}
      <dialog
        ref={clearDialogRef}
        aria-labelledby="clear-dialog-title"
        aria-describedby="clear-dialog-desc"
        className="bg-brand-surface border border-brand-border/60 rounded-xl p-6 text-slate-100 max-w-md w-full backdrop:bg-black/70 shadow-2xl focus:outline-none"
      >
        <h3 id="clear-dialog-title" className="text-lg font-bold text-white mb-3">
          共通クリア (リセット) の確認
        </h3>
        <p id="clear-dialog-desc" className="text-sm text-slate-300 mb-6 leading-relaxed">
          置換マップと仮名化・復元の入力エリアが完全に消去されます。この操作は取り消せません。よろしいですか？
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={closeClearDialog}
            className="px-4 py-2 border border-brand-border/40 hover:bg-brand-card text-slate-300 rounded-md text-sm font-semibold transition"
          >
            キャンセル
          </button>
          <button
            onClick={() => {
              onClearAll();
              closeClearDialog();
            }}
            className="px-5 py-2 bg-brand-danger hover:bg-red-600 text-white rounded-md text-sm font-semibold transition"
          >
            クリア実行
          </button>
        </div>
      </dialog>

      {/* 2. インポートプレビューダイアログ */}
      <dialog
        ref={importDialogRef}
        aria-labelledby="import-dialog-title"
        aria-describedby="import-dialog-desc"
        className="bg-brand-surface border border-brand-border/60 rounded-xl p-6 text-slate-100 max-w-lg w-full backdrop:bg-black/70 shadow-2xl focus:outline-none"
      >
        <h3 id="import-dialog-title" className="text-lg font-bold text-white mb-3">
          マップインポートのプレビュー
        </h3>
        {previewData && (
          <div id="import-dialog-desc" className="space-y-4 mb-6">
            <div className="bg-brand-input/40 p-4 rounded-lg border border-brand-border/20 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">ファイル作成日時:</span>
                <span className="font-mono text-slate-200">
                  {new Date(previewData.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">スキーマバージョン:</span>
                <span className="font-mono text-slate-200">{previewData.version}</span>
              </div>
            </div>

            <h4 className="text-sm font-semibold text-slate-200">インポートサマリー</h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-brand-card/30 p-3 rounded-lg border border-brand-border/10">
                <div className="text-xs text-slate-400">読み込み総数</div>
                <div className="text-lg font-bold text-white mt-1">{previewData.totalCount}件</div>
              </div>
              <div className="bg-brand-card/30 p-3 rounded-lg border border-brand-border/10">
                <div className="text-xs text-brand-warning">重複スキップ</div>
                <div className="text-lg font-bold text-brand-warning mt-1">{previewData.skipCount}件</div>
              </div>
              <div className="bg-brand-card/30 p-3 rounded-lg border border-brand-border/10">
                <div className="text-xs text-brand-primary">タグ衝突再採番</div>
                <div className="text-lg font-bold text-brand-primary mt-1">{previewData.renumberedCount}件</div>
              </div>
            </div>

            <div className="flex gap-3 bg-brand-primary/10 border border-brand-border/20 border-l-4 border-l-brand-primary p-3 rounded-r-lg">
              <svg className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex flex-col gap-1">
                <strong className="text-xs text-slate-200 font-bold">マッピング取り込み時の仕様</strong>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  同一の仮名化対象（original）が存在する場合は既存のタグを優先して適用し、重複する取り込みはスキップされます。タグ連番が衝突した場合は、既存の最大連番に続けて自動的に再採番されます。
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={closeImportDialog}
            className="px-4 py-2 border border-brand-border/40 hover:bg-brand-card text-slate-300 rounded-md text-sm font-semibold transition"
          >
            キャンセル
          </button>
          <button
            onClick={confirmImport}
            className="px-5 py-2 bg-brand-primary hover:bg-brand-primaryHover text-emerald-950 rounded-md text-sm font-extrabold tracking-wide transition"
          >
            インポート確定
          </button>
        </div>
      </dialog>

      {/* 3. エクスポート注意ダイアログ */}
      <dialog
        ref={exportDialogRef}
        aria-labelledby="export-dialog-title"
        aria-describedby="export-dialog-desc"
        className="bg-brand-surface border border-brand-border/60 rounded-xl p-6 text-slate-100 max-w-md w-full backdrop:bg-black/70 shadow-2xl focus:outline-none"
      >
        <h3 id="export-dialog-title" className="text-lg font-bold text-white mb-3">
          マップエクスポートの確認
        </h3>
        <p id="export-dialog-desc" className="text-sm text-slate-300 mb-6 leading-relaxed">
          置換マップには機密データの生データ（元の個人情報やAPIキー等）がプレーンテキストとして含まれています。ファイルの取り扱いには十分注意してください。
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={closeExportDialog}
            className="px-4 py-2 border border-brand-border/40 hover:bg-brand-card text-slate-300 rounded-md text-sm font-semibold transition"
          >
            キャンセル
          </button>
          <button
            onClick={confirmExport}
            className="px-5 py-2 bg-brand-primary hover:bg-brand-primaryHover text-emerald-950 rounded-md text-sm font-extrabold tracking-wide transition"
          >
            同意してエクスポート
          </button>
        </div>
      </dialog>
    </div>
  );
}
