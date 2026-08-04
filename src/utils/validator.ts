import { MappingItem } from './maskEngine';

export interface ValidationError {
  path: string;
  message: string;
}

// RFC 3339 準拠の厳密な日付妥当性検証 (要求事項5)
function isValidRFC3339(dateStr: string): boolean {
  const regex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|([+-]\d{2}):(\d{2}))$/i;
  const match = dateStr.match(regex);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = parseInt(match[6], 10);

  if (month < 1 || month > 12) return false;

  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  if (isLeap) {
    daysInMonth[1] = 29;
  }
  if (day < 1 || day > daysInMonth[month - 1]) return false;

  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second < 0 || second > 60) return false;

  if (match[8] && match[9]) {
    const tzHour = parseInt(match[8], 10);
    const tzMin = parseInt(match[9], 10);
    if (Math.abs(tzHour) > 23) return false;
    if (tzMin < 0 || tzMin > 59) return false;
  }

  return true;
}

// タグの正規表現パターン
const VALID_TAG_PATTERN = /^\[CN_(APIKEY|IPV4|IPV6|EMAIL|PHONE|CUSTOM)_(\d{4})\]$/;

export function validateMappingJSON(data: unknown): { isValid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (typeof data !== 'object' || data === null) {
    errors.push({ path: 'root', message: 'データはJSONオブジェクトでなければなりません' });
    return { isValid: false, errors };
  }

  const obj = data as Record<string, unknown>;

  // 1. 未知フィールド (additionalProperties: false) のチェック
  const allowedRootKeys = ['version', 'createdAt', 'mappings'];
  Object.keys(obj).forEach(key => {
    if (!allowedRootKeys.includes(key)) {
      errors.push({ path: `root.${key}`, message: `未知のプロパティです: ${key}` });
    }
  });

  // 2. 必須フィールドの存在チェック
  if (obj.version === undefined) {
    errors.push({ path: 'root.version', message: 'versionは必須項目です' });
  } else if (obj.version !== "1.0") {
    // Schemaのconst制約に厳密に合致 (要求事項5)
    errors.push({ path: 'root.version', message: 'versionは "1.0" でなければなりません' });
  }

  if (obj.createdAt === undefined) {
    errors.push({ path: 'root.createdAt', message: 'createdAtは必須項目です' });
  } else if (typeof obj.createdAt !== 'string' || !isValidRFC3339(obj.createdAt)) {
    errors.push({ path: 'root.createdAt', message: 'createdAtは正しいISO-8601日時形式でなければなりません' });
  }

  if (obj.mappings === undefined) {
    errors.push({ path: 'root.mappings', message: 'mappingsは必須項目です' });
    return { isValid: false, errors };
  }

  if (!Array.isArray(obj.mappings)) {
    errors.push({ path: 'root.mappings', message: 'mappingsは配列形式でなければなりません' });
    return { isValid: false, errors };
  }

  // 3. maxItems: 1000 の検証
  if (obj.mappings.length > 1000) {
    errors.push({ path: 'root.mappings', message: 'インポート可能なマッピング数は最大1000件です' });
  }

  // 4. マッピングリスト内各要素の個別バリデーション
  obj.mappings.forEach((item, index) => {
    const pathPrefix = `root.mappings[${index}]`;

    if (typeof item !== 'object' || item === null) {
      errors.push({ path: pathPrefix, message: 'マッピング要素はオブジェクトでなければなりません' });
      return;
    }

    const m = item as Record<string, unknown>;

    // 未知プロパティチェック (additionalProperties: false)
    const allowedItemKeys = ['tag', 'original', 'category'];
    Object.keys(m).forEach(key => {
      if (!allowedItemKeys.includes(key)) {
        errors.push({ path: `${pathPrefix}.${key}`, message: `未知のマッピングプロパティです: ${key}` });
      }
    });

    // 必須属性チェック
    if (m.tag === undefined) {
      errors.push({ path: `${pathPrefix}.tag`, message: 'tagは必須項目です' });
    }
    if (m.original === undefined) {
      errors.push({ path: `${pathPrefix}.original`, message: 'originalは必須項目です' });
    }
    if (m.category === undefined) {
      errors.push({ path: `${pathPrefix}.category`, message: 'categoryは必須項目です' });
    }

    // tagの型と文字長
    if (typeof m.tag === 'string') {
      if (m.tag.length === 0) {
        errors.push({ path: `${pathPrefix}.tag`, message: 'tagは空文字にできません' });
      } else if (!VALID_TAG_PATTERN.test(m.tag)) {
        errors.push({ path: `${pathPrefix}.tag`, message: 'tagのフォーマットが正しくありません (例: [CN_EMAIL_0001])' });
      }
    } else if (m.tag !== undefined) {
      errors.push({ path: `${pathPrefix}.tag`, message: 'tagは文字列でなければなりません' });
    }

    // originalの型と文字長 (maxLength: 1000 の検証を追加 - 要求事項2&6)
    if (typeof m.original === 'string') {
      if (m.original.length === 0) {
        errors.push({ path: `${pathPrefix}.original`, message: 'originalは空文字にできません' });
      } else if (m.original.length > 1000) {
        errors.push({ path: `${pathPrefix}.original`, message: 'originalは最大1000文字以下でなければなりません' });
      }
    } else if (m.original !== undefined) {
      errors.push({ path: `${pathPrefix}.original`, message: 'originalは文字列でなければなりません' });
    }

    // categoryのenum
    const validCategories = ['APIKEY', 'IPV4', 'IPV6', 'EMAIL', 'PHONE', 'CUSTOM'];
    if (typeof m.category === 'string') {
      if (!validCategories.includes(m.category)) {
        errors.push({ path: `${pathPrefix}.category`, message: `無効なカテゴリです: ${m.category}` });
      }
    } else if (m.category !== undefined) {
      errors.push({ path: `${pathPrefix}.category`, message: 'categoryは文字列でなければなりません' });
    }

    // 5. アプリケーション層での整合性チェック (タグ内カテゴリとcategoryの一致)
    if (typeof m.tag === 'string' && typeof m.category === 'string') {
      const match = m.tag.match(VALID_TAG_PATTERN);
      if (match) {
        const tagCategory = match[1];
        if (tagCategory !== m.category) {
          errors.push({
            path: `${pathPrefix}.tag`,
            message: `タグ内のカテゴリ(${tagCategory})と、指定されたcategory属性(${m.category})が一致していません`
          });
        }
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * インポートしたマッピングと現在のマッピングを競合マージする処理 (要求事項7)
 *
 * 【ロールバック保証の関数契約】:
 * 本関数は引数の current / imported を破壊せず、マージされた新規の配列を生成・返却するイミュータブルな設計となっています。
 * 途中で 9999 上限エラー（getNextTagNumberの例外スロー）や 1000 件超過エラーが発生した場合、例外が呼び出し元に伝播し、
 * 中間状態の配列は捨てられ、呼び出し元の React 状態や localStorage 等へは一切適用されない（トランザクションロールバック）ことが保証されます。
 */
export function mergeImportedMappings(
  current: MappingItem[],
  imported: Omit<MappingItem, 'source'>[]
): { merged: MappingItem[]; renumberedCount: number } {
  const merged: MappingItem[] = [...current];
  let renumberedCount = 0;

  for (const imp of imported) {
    // 重複判定規則: 「カテゴリに関わらず同じoriginalなら既存タグを優先」 (要求事項7)
    const existing = merged.find(m => m.original === imp.original);
    if (existing) {
      continue; // スキップ
    }

    // タグの衝突確認
    const tagConflict = merged.find(m => m.tag === imp.tag);

    if (tagConflict) {
      // 衝突した場合は新規に採番
      const currentNumbers = merged
        .filter(m => m.category === imp.category)
        .map(m => {
          const match = m.tag.match(/_(\d{4})\]$/);
          return match ? parseInt(match[1], 10) : 0;
        });
      const maxNum = currentNumbers.length > 0 ? Math.max(...currentNumbers) : 0;
      const nextNum = maxNum + 1;

      if (nextNum > 9999) {
        throw new Error(`マージ採番中に上限(9999)に達しました: ${imp.category}`);
      }

      const newTag = `[CN_${imp.category}_${nextNum.toString().padStart(4, '0')}]`;
      merged.push({
        tag: newTag,
        original: imp.original,
        category: imp.category,
        source: 'IMPORT'
      });
      renumberedCount++;
    } else {
      merged.push({
        tag: imp.tag,
        original: imp.original,
        category: imp.category,
        source: 'IMPORT'
      });
    }
  }

  // マージ後の総数が1000件を超えていないかチェック (要求事項7)
  if (merged.length > 1000) {
    throw new Error('マージ後の置換マップが上限(1000件)を超えたため、インポートを却下しました');
  }

  return {
    merged,
    renumberedCount
  };
}
