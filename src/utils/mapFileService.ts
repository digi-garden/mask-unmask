import { MappingItem } from './maskEngine';
import { validateMappingJSON } from './validator';

export interface FileLoadResult {
  version: string;
  createdAt: string;
  mappings: Omit<MappingItem, 'source'>[];
}

// ファイル読み込みとパース、サイズ検証 (500KB制限)
export function readMapFile(file: File): Promise<FileLoadResult> {
  return new Promise((resolve, reject) => {
    if (file.size > 500 * 1024) {
      reject(new Error('ファイルサイズは500KB以下である必要があります'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          reject(new Error('ファイルをテキストとして読み込めませんでした'));
          return;
        }

        const parsed = JSON.parse(text);

        const { isValid, errors } = validateMappingJSON(parsed);
        if (!isValid) {
          const errMsg = errors.map(err => `${err.path}: ${err.message}`).join('\n');
          reject(new Error(`JSONの検証に失敗しました:\n${errMsg}`));
          return;
        }

        resolve(parsed as FileLoadResult);
      } catch (err) {
        reject(new Error('JSONファイルのパースに失敗しました。ファイルが壊れている可能性があります。'));
      }
    };

    reader.onerror = () => {
      reject(new Error('ファイルの読み込み中にエラーが発生しました'));
    };

    reader.readAsText(file, 'UTF-8');
  });
}

// エクスポート用のデータ構造化とBlob URLの作成
export function exportMapFile(mappings: MappingItem[]): { url: string; filename: string } {
  // エクスポート用データから内部状態 `source` を除外する
  const sanitizedMappings = mappings.map(({ tag, original, category }) => ({
    tag,
    original,
    category
  }));

  const exportData = {
    version: "1.0", // versionを1.0に統一 (要求事項5)
    createdAt: new Date().toISOString(),
    mappings: sanitizedMappings
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `mask-unmask-map-${timestamp}.json`;

  return {
    url,
    filename
  };
}

// メモリ解放処理
export function revokeExportUrl(url: string): void {
  URL.revokeObjectURL(url);
}
