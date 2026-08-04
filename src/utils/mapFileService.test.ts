import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readMapFile, exportMapFile, revokeExportUrl } from './mapFileService';
import { MappingItem } from './maskEngine';

describe('mapFileService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // URL.createObjectURL と URL.revokeObjectURL のグローバルモック
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  describe('readMapFile', () => {
    it('500KBを超えるファイルをインポートした際に拒否すること (要求事項8)', async () => {
      // 500KB を超えるダミーファイル (512,001 bytes)
      const hugeFile = new File(['a'.repeat(500 * 1024 + 1)], 'map.json', { type: 'application/json' });

      await expect(readMapFile(hugeFile)).rejects.toThrow('500KB以下である必要があります');
    });

    it('有効な UTF-8 JSON マップファイルを正常にパースして返すこと', async () => {
      const validJSON = JSON.stringify({
        version: "1.0",
        createdAt: "2026-07-31T05:00:00Z",
        mappings: [
          { tag: "[CN_EMAIL_0001]", original: "john@example.com", category: "EMAIL" }
        ]
      });
      const file = new File([validJSON], 'map.json', { type: 'application/json' });

      const result = await readMapFile(file);
      expect(result.version).toBe("1.0");
      expect(result.mappings.length).toBe(1);
      expect(result.mappings[0].original).toBe("john@example.com");
    });

    it('不正なJSONや、バリデーション違反のファイルを却下すること', async () => {
      // 1. 不正なJSON
      const invalidJSON = "{ broken json";
      const file1 = new File([invalidJSON], 'map.json', { type: 'application/json' });
      await expect(readMapFile(file1)).rejects.toThrow();

      // 2. バリデーション違反 (version欠損)
      const invalidSchema = JSON.stringify({
        createdAt: "2026-07-31T05:00:00Z",
        mappings: []
      });
      const file2 = new File([invalidSchema], 'map.json', { type: 'application/json' });
      await expect(readMapFile(file2)).rejects.toThrow('versionは必須項目です');
    });
  });

  describe('exportMapFile', () => {
    const sampleMappings: MappingItem[] = [
      { tag: "[CN_EMAIL_0001]", original: "john@example.com", category: "EMAIL", source: "AUTO" }
    ];

    it('version 1.0 で正しくエクスポートデータを出力すること', () => {
      const { url, filename } = exportMapFile(sampleMappings);
      expect(url).toBe('blob:http://localhost/mock-url');
      expect(filename).toContain('mask-unmask-map-');

      // createObjectURLが呼ばれたことの確認
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });

    it('エクスポートデータから内部用 source フィールドが除外されていること', () => {
      exportMapFile(sampleMappings);
      const mockCreateObjectURL = vi.mocked(window.URL.createObjectURL);
      const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;

      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(reader.result as string);
            expect(parsed.version).toBe("1.0");
            expect(parsed.mappings[0].tag).toBe("[CN_EMAIL_0001]");
            expect(parsed.mappings[0].source).toBeUndefined();
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsText(blobArg);
      });
    });
  });

  describe('revokeExportUrl', () => {
    it('URL.revokeObjectURLを呼び出してメモリ解放すること', () => {
      revokeExportUrl('blob:mock-url');
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
