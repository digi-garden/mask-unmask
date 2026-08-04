import { describe, it, expect } from 'vitest';
import { validateMappingJSON, mergeImportedMappings } from './validator';
import { MappingItem } from './maskEngine';

describe('validator', () => {

  describe('validateMappingJSON', () => {
    const validData = {
      version: "1.0", // versionは1.0に統一
      createdAt: "2026-07-31T05:00:00.000Z",
      mappings: [
        { tag: "[CN_EMAIL_0001]", original: "test@test.com", category: "EMAIL" }
      ]
    };

    it('有効なデータ構造の場合、isValid: true を返すこと', () => {
      const { isValid, errors } = validateMappingJSON(validData);
      expect(isValid).toBe(true);
      expect(errors.length).toBe(0);
    });

    it('versionが異なる、または欠損している場合は却下すること (const制約)', () => {
      const invalid = { ...validData, version: "1" }; // "1"は却下
      const { isValid } = validateMappingJSON(invalid);
      expect(isValid).toBe(false);
    });

    it('createdAtが不正な日時の場合は却下すること (format: date-time制約 & 論理日付検証)', () => {
      // 1. フォーマット自体が不正な場合
      const invalidFormat = { ...validData, createdAt: "2026-07-31 05:00:00" }; // Tがない
      expect(validateMappingJSON(invalidFormat).isValid).toBe(false);

      // 2. 論理的な日付が不正な場合 (99月99日)
      const invalidLogic = { ...validData, createdAt: "2026-99-99T12:00:00Z" };
      expect(validateMappingJSON(invalidLogic).isValid).toBe(false);

      // 3. うるう年以外の2月30日 (存在しない日付)
      const nonLeapFeb30 = { ...validData, createdAt: "2026-02-30T12:00:00Z" };
      expect(validateMappingJSON(nonLeapFeb30).isValid).toBe(false);

      // 4. うるう年の2月29日 (有効な日付)
      const leapFeb29 = { ...validData, createdAt: "2024-02-29T12:00:00Z" };
      expect(validateMappingJSON(leapFeb29).isValid).toBe(true);
    });

    it('originalの文字数が1000文字を超える場合は却下すること (maxLength制約)', () => {
      const tooLongOriginal = 'a'.repeat(1001);
      const invalid = {
        ...validData,
        mappings: [
          { tag: "[CN_CUSTOM_0001]", original: tooLongOriginal, category: "CUSTOM" }
        ]
      };
      const { isValid, errors } = validateMappingJSON(invalid);
      expect(isValid).toBe(false);
      expect(errors[0].message).toContain('最大1000文字以下');
    });

    it('マッピング数が1000件を超える場合は却下すること (maxItems制約)', () => {
      const hugeMappings = Array.from({ length: 1001 }, (_, i) => ({
        tag: `[CN_CUSTOM_${i.toString().padStart(4, '0')}]`,
        original: `dummy-${i}`,
        category: "CUSTOM" as const
      }));
      const invalid = { ...validData, mappings: hugeMappings };
      const { isValid } = validateMappingJSON(invalid);
      expect(isValid).toBe(false);
    });

    it('未知のプロパティが含まれる場合は却下すること (additionalProperties: false)', () => {
      const invalidRoot = { ...validData, unknownKey: "val" };
      expect(validateMappingJSON(invalidRoot).isValid).toBe(false);

      const invalidItem = {
        ...validData,
        mappings: [{ ...validData.mappings[0], source: "AUTO" }]
      };
      expect(validateMappingJSON(invalidItem).isValid).toBe(false);
    });

    it('タグ内のカテゴリとcategory属性が一致しない場合は却下すること (一貫性検証)', () => {
      const invalid = {
        ...validData,
        mappings: [
          { tag: "[CN_EMAIL_0001]", original: "test@test.com", category: "IPV4" }
        ]
      };
      const { isValid, errors } = validateMappingJSON(invalid);
      expect(isValid).toBe(false);
      expect(errors[0].message).toContain('一致していません');
    });
  });

  describe('mergeImportedMappings', () => {
    it('重複のないインポート項目はそのまま追加されること', () => {
      const current: MappingItem[] = [
        { tag: "[CN_EMAIL_0001]", original: "a@a.com", category: "EMAIL", source: "AUTO" }
      ];
      const imported = [
        { tag: "[CN_IPV4_0001]", original: "1.1.1.1", category: "IPV4" as const }
      ];

      const { merged, renumberedCount } = mergeImportedMappings(current, imported);
      expect(merged.length).toBe(2);
      expect(renumberedCount).toBe(0);
      expect(merged[1].source).toBe('IMPORT');
    });

    it('同じoriginalが存在する場合は、カテゴリが異なっていてもマージせず既存タグを優先すること (重複規則修正)', () => {
      const current: MappingItem[] = [
        { tag: "[CN_EMAIL_0001]", original: "secret-value", category: "EMAIL", source: "AUTO" }
      ];
      const imported = [
        { tag: "[CN_CUSTOM_0001]", original: "secret-value", category: "CUSTOM" as const } // カテゴリがCUSTOMで別だが、originalが重複
      ];

      const { merged } = mergeImportedMappings(current, imported);
      expect(merged.length).toBe(1); // スキップされて追加されない
      expect(merged[0].tag).toBe("[CN_EMAIL_0001]");
    });

    it('マージ後の総件数が1000件を超える場合は例外をスローしてロールバックすること', () => {
      const current: MappingItem[] = Array.from({ length: 800 }, (_, i) => ({
        tag: `[CN_CUSTOM_${i.toString().padStart(4, '0')}]`,
        original: `curr-${i}`,
        category: "CUSTOM" as const,
        source: "AUTO"
      }));
      const imported = Array.from({ length: 201 }, (_, i) => ({
        tag: `[CN_CUSTOM_${(i + 800).toString().padStart(4, '0')}]`,
        original: `imp-${i}`,
        category: "CUSTOM" as const
      }));

      // 合計 1001 件になるためエラーが投げられ、元の current は破壊されない (イミュータビリティ)
      expect(() => mergeImportedMappings(current, imported)).toThrow('上限(1000件)を超えたため');
      expect(current.length).toBe(800); // 破壊されていない
    });

    it('タグのみが衝突している場合は新規に採番(リナンバリング)されること', () => {
      const current: MappingItem[] = [
        { tag: "[CN_EMAIL_0001]", original: "a@a.com", category: "EMAIL", source: "AUTO" }
      ];
      const imported = [
        { tag: "[CN_EMAIL_0001]", original: "diff@diff.com", category: "EMAIL" as const }
      ];

      const { merged, renumberedCount } = mergeImportedMappings(current, imported);
      expect(merged.length).toBe(2);
      expect(renumberedCount).toBe(1);
      expect(merged[1].tag).toBe("[CN_EMAIL_0002]");
      expect(merged[1].original).toBe("diff@diff.com");
    });
  });
});
