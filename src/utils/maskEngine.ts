export interface MappingItem {
  tag: string;
  original: string;
  category: 'APIKEY' | 'IPV4' | 'IPV6' | 'EMAIL' | 'PHONE' | 'CUSTOM';
  source: 'AUTO' | 'CUSTOM' | 'IMPORT';
}

export interface DetectionMatch {
  start: number;
  end: number;
  original: string;
  category: MappingItem['category'];
  source: MappingItem['source'];
}

// lastIndex 汚染を防ぐために、実行の都度新しい RegExp インスタンスを返す
export function createTagRegex(): RegExp {
  return /\[\s*CN\s*_\s*(APIKEY|IPV4|IPV6|EMAIL|PHONE|CUSTOM)\s*_\s*(\d{4})\s*\]/gi;
}

// 自動検出用の各カテゴリの正規表現定義
const AUTO_DETECT_REGEX: Record<'APIKEY' | 'IPV4' | 'IPV6' | 'EMAIL' | 'PHONE', RegExp> = {
  // GitHubトークン、OpenAI、AWSキーの大文字・小文字を厳密に区別するよう /g のみに制限 (要求事項1)
  APIKEY: /(?<![a-zA-Z0-9])(?:sk-proj-[a-zA-Z0-9]{40,})(?![a-zA-Z0-9])|(?<![a-zA-Z0-9])(?:AKIA[0-9A-Z]{16})(?![a-zA-Z0-9])|(?<![a-zA-Z0-9])(?:ghp_[a-zA-Z0-9]{36})(?![a-zA-Z0-9])/g,

  // IPV4 (ポート番号 :ポート、および CIDR /ビット数 を含めて検出する。Ref混入を除去)
  IPV4: /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d+|\/\d+)?\b/g,

  // IPV6 (角括弧の左右不均衡なものを除外するため、括弧ありグループと括弧なしグループに明確に分離)
  IPV6: /\[(?:[0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}(?:%[0-9a-zA-Z]+)?\](?::\d+)?|\[(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}(?:%[0-9a-zA-Z]+)?\](?::\d+)?|\[(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}(?:%[0-9a-zA-Z]+)?\](?::\d+)?|\[(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}(?:%[0-9a-zA-Z]+)?\](?::\d+)?|\[(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}(?:%[0-9a-zA-Z]+)?\](?::\d+)?|\[(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}(?:%[0-9a-zA-Z]+)?\](?::\d+)?|\[[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}(?:%[0-9a-zA-Z]+)?\](?::\d+)?|\[(?:[0-9a-fA-F]{1,4}:){1,7}:(?:%[0-9a-zA-Z]+)?\](?::\d+)?|\[:(?::[0-9a-fA-F]{1,4}){1,7}(?:%[0-9a-zA-Z]+)?\](?::\d+)?|\[::(?:%[0-9a-zA-Z]+)?\](?::\d+)?|(?<![a-zA-Z0-9:])(?:[0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}(?:%[0-9a-zA-Z]+)?(?![a-zA-Z0-9:])|(?<![a-zA-Z0-9:])(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}(?:%[0-9a-zA-Z]+)?(?![a-zA-Z0-9:])|(?<![a-zA-Z0-9:])(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}(?:%[0-9a-zA-Z]+)?(?![a-zA-Z0-9:])|(?<![a-zA-Z0-9:])(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}(?:%[0-9a-zA-Z]+)?(?![a-zA-Z0-9:])|(?<![a-zA-Z0-9:])(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}(?:%[0-9a-zA-Z]+)?(?![a-zA-Z0-9:])|(?<![a-zA-Z0-9:])(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}(?:%[0-9a-zA-Z]+)?(?![a-zA-Z0-9:])|(?<![a-zA-Z0-9:])[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}(?:%[0-9a-zA-Z]+)?(?![a-zA-Z0-9:])|(?<![a-zA-Z0-9:])(?:[0-9a-fA-F]{1,4}:){1,7}:(?:%[0-9a-zA-Z]+)?(?![a-zA-Z0-9:])|(?<![a-zA-Z0-9:]):(?::[0-9a-fA-F]{1,4}){1,7}(?:%[0-9a-zA-Z]+)?(?![a-zA-Z0-9:])|(?<![a-zA-Z0-9:])::(?:%[0-9a-zA-Z]+)?(?![a-zA-Z0-9:])/g,

  // EMAIL
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // PHONE (日本の携帯、固定、国際表記ハイフン有無)
  PHONE: /(?:\+81|0)(?:[-.\s]?\d){9,10}\b/g
};

// 既存タグ形式が含まれるか検証する関数
export function detectExistingTags(text: string): boolean {
  const regex = createTagRegex();
  return regex.test(text);
}

// 表記揺れ標準化関数 (空白除去・大文字化)
export function normalizeTag(tagStr: string): string {
  const clean = tagStr.replace(/\s+/g, '').toUpperCase();
  const match = clean.match(/^\[CN_(APIKEY|IPV4|IPV6|EMAIL|PHONE|CUSTOM)_(\d{4})\]$/);
  if (!match) return "";
  return clean;
}

// カテゴリ優先順位
const CATEGORY_PRIORITY: Record<MappingItem['category'], number> = {
  APIKEY: 1,
  EMAIL: 2,
  PHONE: 3,
  IPV6: 4,
  IPV4: 5,
  CUSTOM: 6
};

// 滝流れタイブレーク一括競合解決
export function resolveConflicts(matches: DetectionMatch[]): DetectionMatch[] {
  const sorted = [...matches].sort((a, b) => {
    // 1. 来歴
    const aIsCustom = a.source === 'CUSTOM' || a.source === 'IMPORT';
    const bIsCustom = b.source === 'CUSTOM' || b.source === 'IMPORT';
    if (aIsCustom !== bIsCustom) {
      return aIsCustom ? -1 : 1;
    }
    // 2. マッチ長
    const aLen = a.end - a.start;
    const bLen = b.end - b.start;
    if (aLen !== bLen) {
      return bLen - aLen;
    }
    // 3. カテゴリ優先度
    const aPriority = CATEGORY_PRIORITY[a.category];
    const bPriority = CATEGORY_PRIORITY[b.category];
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    // 4. 開始位置
    return a.start - b.start;
  });

  const resolved: DetectionMatch[] = [];
  for (const match of sorted) {
    const isConflict = resolved.some(existing => {
      return !(match.end <= existing.start || match.start >= existing.end);
    });
    if (!isConflict) {
      resolved.push(match);
    }
  }

  return resolved.sort((a, b) => a.start - b.start);
}

// 連番の生成
export function getNextTagNumber(
  mappings: MappingItem[],
  category: MappingItem['category']
): number {
  const currentNumbers = mappings
    .filter(m => m.category === category)
    .map(m => {
      const match = m.tag.match(/_(\d{4})\]$/);
      return match ? parseInt(match[1], 10) : 0;
    });

  const maxNum = currentNumbers.length > 0 ? Math.max(...currentNumbers) : 0;
  const nextNum = maxNum + 1;
  if (nextNum > 9999) {
    throw new Error(`連番が上限(9999)に達しました: ${category}`);
  }
  return nextNum;
}

// Mask 処理メイン
export function maskText(
  inputText: string,
  existingMappings: MappingItem[],
  toggles: Record<'APIKEY' | 'IPV4' | 'IPV6' | 'EMAIL' | 'PHONE', boolean>,
  excludeList: string[] = []
): { maskedText: string; newMappings: MappingItem[]; hasExistingTags?: boolean } {
  // 1. 既存の正式タグが入力に含まれる場合は、処理を中断してフラグを返す (要求事項10)
  if (detectExistingTags(inputText)) {
    return { maskedText: inputText, newMappings: [], hasExistingTags: true };
  }

  // 空文字はそのまま
  if (!inputText.trim()) {
    return { maskedText: inputText, newMappings: [], hasExistingTags: false };
  }

  const rawMatches: DetectionMatch[] = [];

  // 2. 既存の CUSTOM / IMPORT / AUTO マッピング項目を適用候補としてスキャン
  existingMappings.forEach(item => {
    // 空文字列による無限ループを防御的に防ぐ (要求事項2)
    if (!item.original) return;

    let index = inputText.indexOf(item.original);
    while (index !== -1) {
      if (!excludeList.includes(item.original)) {
        const isAutoEnabled = item.source !== 'AUTO' || toggles[item.category as keyof typeof toggles];
        if (isAutoEnabled) {
          rawMatches.push({
            start: index,
            end: index + item.original.length,
            original: item.original,
            category: item.category,
            source: item.source
          });
        }
      }
      index = inputText.indexOf(item.original, index + 1);
    }
  });

  // 3. 新たな自動検出のスキャン (トグルがONのカテゴリのみ)
  (Object.keys(AUTO_DETECT_REGEX) as Array<keyof typeof AUTO_DETECT_REGEX>).forEach(category => {
    if (toggles[category]) {
      const regex = new RegExp(AUTO_DETECT_REGEX[category]);
      let match;
      while ((match = regex.exec(inputText)) !== null) {
        let matchedStr = match[0];
        // 空文字検知による無限ループ防止の安全ガード
        if (!matchedStr) continue;

        let start = match.index;
        let end = match.index + matchedStr.length;

        // IPv4/IPv6のポート・CIDR数値検証 (要求事項2)
        if (category === 'IPV4') {
          const portMatch = matchedStr.match(/:(\d+)$/);
          const cidrMatch = matchedStr.match(/\/(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1], 10);
            if (port < 0 || port > 65535) {
              matchedStr = matchedStr.slice(0, -portMatch[0].length);
              end = start + matchedStr.length;
            }
          } else if (cidrMatch) {
            const cidr = parseInt(cidrMatch[1], 10);
            if (cidr < 0 || cidr > 32) {
              matchedStr = matchedStr.slice(0, -cidrMatch[0].length);
              end = start + matchedStr.length;
            }
          }
        } else if (category === 'IPV6') {
          const portMatch = matchedStr.match(/:(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1], 10);
            if (port < 0 || port > 65535) {
              matchedStr = matchedStr.slice(0, -portMatch[0].length);
              end = start + matchedStr.length;
            }
          }
        }

        if (!excludeList.includes(matchedStr)) {
          rawMatches.push({
            start,
            end,
            original: matchedStr,
            category: category,
            source: 'AUTO'
          });
        }
      }
    }
  });

  // 4. 競合解決
  const finalMatches = resolveConflicts(rawMatches);

  // 5. スライシング再構築
  let maskedText = "";
  let lastIndex = 0;
  const newMappings: MappingItem[] = [];
  const activeMappings = [...existingMappings];

  for (const match of finalMatches) {
    maskedText += inputText.slice(lastIndex, match.start);

    let mapping = activeMappings.find(
      m => m.original === match.original && m.category === match.category
    );

    if (!mapping) {
      const nextNum = getNextTagNumber(activeMappings, match.category);
      const tag = `[CN_${match.category}_${nextNum.toString().padStart(4, '0')}]`;
      mapping = {
        tag,
        original: match.original,
        category: match.category,
        source: match.source
      };
      activeMappings.push(mapping);
      newMappings.push(mapping);
    }

    maskedText += mapping.tag;
    lastIndex = match.end;
  }

  maskedText += inputText.slice(lastIndex);

  return { maskedText, newMappings, hasExistingTags: false };
}

// Unmask 処理メイン
export function unmaskText(
  inputText: string,
  mappings: MappingItem[]
): { unmaskedText: string; restoreCount: number; unrestoredTags: string[] } {
  if (!inputText.trim()) {
    return { unmaskedText: inputText, restoreCount: 0, unrestoredTags: [] };
  }

  // 1. タグ候補の抽出 (表記揺れを含む)
  const regex = createTagRegex();
  const rawMatches: Array<{ start: number; end: number; tagStr: string; normalized: string }> = [];

  let match;
  while ((match = regex.exec(inputText)) !== null) {
    const tagStr = match[0];
    const normalized = normalizeTag(tagStr);
    if (normalized) {
      rawMatches.push({
        start: match.index,
        end: match.index + tagStr.length,
        tagStr,
        normalized
      });
    }
  }

  // 2. 競合解決
  const sortedMatches = rawMatches.sort((a, b) => {
    const aLen = a.end - a.start;
    const bLen = b.end - b.start;
    if (aLen !== bLen) {
      return bLen - aLen;
    }
    return a.start - b.start;
  });

  const nonOverlapping: typeof rawMatches = [];
  for (const item of sortedMatches) {
    const isConflict = nonOverlapping.some(existing => {
      return !(item.end <= existing.start || item.start >= existing.end);
    });
    if (!isConflict) {
      nonOverlapping.push(item);
    }
  }

  nonOverlapping.sort((a, b) => a.start - b.start);

  // 3. マップ照合とスライシング置換
  let unmaskedText = "";
  let lastIndex = 0;
  const restoredTags = new Set<string>(); // ユニーク件数集計用 (要求事項8)
  const unrestoredTagsSet = new Set<string>();

  for (const item of nonOverlapping) {
    unmaskedText += inputText.slice(lastIndex, item.start);

    const mapping = mappings.find(m => m.tag === item.normalized);

    if (mapping) {
      unmaskedText += mapping.original;
      restoredTags.add(item.normalized);
    } else {
      unmaskedText += item.tagStr;
      unrestoredTagsSet.add(item.normalized);
    }

    lastIndex = item.end;
  }

  unmaskedText += inputText.slice(lastIndex);

  return {
    unmaskedText,
    restoreCount: restoredTags.size, // ユニーク件数を返す
    unrestoredTags: Array.from(unrestoredTagsSet)
  };
}

// マップのライフサイクル同期を行うヘルパー関数 (要求事項4)
export function syncMappings(
  inputText: string,
  currentMappings: MappingItem[],
  toggles: Record<'APIKEY' | 'IPV4' | 'IPV6' | 'EMAIL' | 'PHONE', boolean>
): MappingItem[] {
  // 1. トグルが OFF になったカテゴリに属し、かつ source が "AUTO" であるマップ項目を削除
  let updated = currentMappings.filter(item => {
    if (item.source !== 'AUTO') return true;
    const category = item.category;
    if (category === 'CUSTOM') return true;
    return toggles[category];
  });

  // 2. 入力テキストから自動検出を走り直し、現在テキストに含まれる original を特定する
  const activeOriginals = new Set<string>();

  if (inputText.trim()) {
    (Object.keys(AUTO_DETECT_REGEX) as Array<keyof typeof AUTO_DETECT_REGEX>).forEach(category => {
      if (toggles[category]) {
        const regex = new RegExp(AUTO_DETECT_REGEX[category]);
        let match;
        while ((match = regex.exec(inputText)) !== null) {
          const matchedStr = match[0];
          if (matchedStr) {
            activeOriginals.add(matchedStr);
          }
        }
      }
    });
  }

  // 3. 入力テキストから消失した source: "AUTO" のマッピングを削除する
  updated = updated.filter(item => {
    if (item.source !== 'AUTO') return true;
    return activeOriginals.has(item.original) || inputText.includes(item.original);
  });

  return updated;
}
