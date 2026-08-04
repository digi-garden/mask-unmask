import { useState, useCallback, useRef } from 'react';
import { MappingItem } from '../utils/maskEngine';

export interface PersistedAppState {
  version: number;
  mappings: MappingItem[];
  maskInput: string;
  unmaskInput: string;
  detectionToggles: {
    APIKEY: boolean;
    IPV4: boolean;
    IPV6: boolean;
    EMAIL: boolean;
    PHONE: boolean;
  };
  activeTab: 'mask' | 'unmask';
}

const STORAGE_KEY = 'cn_app_state';
const CURRENT_VERSION = 1;

const DEFAULT_STATE: PersistedAppState = {
  version: CURRENT_VERSION,
  mappings: [],
  maskInput: '',
  unmaskInput: '',
  detectionToggles: {
    APIKEY: true,
    IPV4: true,
    IPV6: true,
    EMAIL: true,
    PHONE: true
  },
  activeTab: 'mask'
};

const VALID_TAG_PATTERN = /^\[CN_(APIKEY|IPV4|IPV6|EMAIL|PHONE|CUSTOM)_(\d{4})\]$/;

// データの構造・値の厳密な検証 (要求事項2 & 6)
function isValidPersistedData(data: unknown): data is PersistedAppState {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  // 状態ルートの余分なキーを排除 (要求事項3)
  const allowedRootKeys = ['version', 'mappings', 'maskInput', 'unmaskInput', 'detectionToggles', 'activeTab'];
  for (const key of Object.keys(obj)) {
    if (!allowedRootKeys.includes(key)) return false;
  }

  if (obj.version !== CURRENT_VERSION) return false;

  // 各入力値
  if (typeof obj.maskInput !== 'string') return false;
  if (typeof obj.unmaskInput !== 'string') return false;
  if (obj.activeTab !== 'mask' && obj.activeTab !== 'unmask') return false;

  // トグル
  if (typeof obj.detectionToggles !== 'object' || obj.detectionToggles === null) return false;
  const toggles = obj.detectionToggles as Record<string, unknown>;
  const toggleKeys = ['APIKEY', 'IPV4', 'IPV6', 'EMAIL', 'PHONE'];
  for (const key of toggleKeys) {
    if (typeof toggles[key] !== 'boolean') return false;
  }
  // トグルの余分なキーを排除 (additionalProperties: false)
  for (const key of Object.keys(toggles)) {
    if (!toggleKeys.includes(key)) return false;
  }

  // マッピング件数 (最大1000)
  if (!Array.isArray(obj.mappings)) return false;
  if (obj.mappings.length > 1000) return false;

  // 各マッピング要素の厳密な中身検証 (空文字による無限ループ防御 & カテゴリ整合性 & 余分なキー排除)
  return obj.mappings.every(item => {
    if (typeof item !== 'object' || item === null) return false;
    const m = item as Record<string, unknown>;

    // original: 1〜1000文字
    if (typeof m.original !== 'string' || m.original.length === 0 || m.original.length > 1000) {
      return false;
    }

    // tag: 正規パターン
    if (typeof m.tag !== 'string' || !VALID_TAG_PATTERN.test(m.tag)) {
      return false;
    }

    const validCategories = ['APIKEY', 'IPV4', 'IPV6', 'EMAIL', 'PHONE', 'CUSTOM'];
    if (typeof m.category !== 'string' || !validCategories.includes(m.category)) {
      return false;
    }

    const validSources = ['AUTO', 'CUSTOM', 'IMPORT'];
    if (typeof m.source !== 'string' || !validSources.includes(m.source)) {
      return false;
    }

    // タグとカテゴリの一致検証 (要求事項6)
    const match = m.tag.match(VALID_TAG_PATTERN);
    if (match) {
      const tagCategory = match[1];
      if (tagCategory !== m.category) return false;
    }

    // マッピングの余分なキーを排除 (additionalProperties: false)
    const allowedKeys = ['tag', 'original', 'category', 'source'];
    for (const key of Object.keys(m)) {
      if (!allowedKeys.includes(key)) return false;
    }

    return true;
  });
}

export function usePersistedState() {
  const getInitialState = (): PersistedAppState => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return DEFAULT_STATE;
      }
      const parsed = JSON.parse(raw);
      if (isValidPersistedData(parsed)) {
        return parsed;
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
        return DEFAULT_STATE;
      }
    } catch (e) {
      sessionStorage.removeItem(STORAGE_KEY);
      return DEFAULT_STATE;
    }
  };

  const [state, setRawState] = useState<PersistedAppState>(getInitialState);

  // 最新状態を追跡するRef
  const stateRef = useRef<PersistedAppState>(state);

  // Reactの実行モデルに沿った安全な更新処理 (要求事項4)
  const setState = useCallback((
    newStateOrUpdater: PersistedAppState | ((prev: PersistedAppState) => PersistedAppState)
  ): { success: boolean; error?: Error } => {
    // 1. 同期的に次の状態を計算
    const nextState = typeof newStateOrUpdater === 'function'
      ? newStateOrUpdater(stateRef.current)
      : newStateOrUpdater;

    // 2. sessionStorageへの書き込みを試行 (副作用をPureなState Updaterの外側で実行)
    try {
      const serialized = JSON.stringify(nextState);
      sessionStorage.setItem(STORAGE_KEY, serialized);

      // 3. 書き込み成功時のみ React State と Ref を更新
      setRawState(nextState);
      stateRef.current = nextState;
      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      // ロールバック: React State も Ref も更新せず、以前の状態を維持
      return { success: false, error };
    }
  }, []);

  const clearState = useCallback((): { success: boolean; error?: Error } => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      const defaultVal = DEFAULT_STATE;
      setRawState(defaultVal);
      stateRef.current = defaultVal;
      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      return { success: false, error };
    }
  }, []);
  return [state, setState, clearState] as const;
}
