import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedState, PersistedAppState } from './usePersistedState';

describe('usePersistedState hook', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  const validSavedData: PersistedAppState = {
    version: 1,
    maskInput: 'hello world',
    unmaskInput: 'hello [CN_EMAIL_0001]',
    activeTab: 'mask',
    detectionToggles: {
      APIKEY: true,
      IPV4: true,
      IPV6: true,
      EMAIL: true,
      PHONE: true
    },
    mappings: [
      { tag: "[CN_EMAIL_0001]", original: "john@example.com", category: "EMAIL", source: "AUTO" }
    ]
  };

  it('初期ロード時にsessionStorageが空ならデフォルト状態を返すこと', () => {
    const { result } = renderHook(() => usePersistedState());
    expect(result.current[0].version).toBe(1);
    expect(result.current[0].mappings).toEqual([]);
    expect(result.current[0].maskInput).toBe('');
    expect(result.current[0].activeTab).toBe('mask');
  });

  it('正常なデータをロードできること', () => {
    sessionStorage.setItem('cn_app_state', JSON.stringify(validSavedData));

    const { result } = renderHook(() => usePersistedState());
    expect(result.current[0].mappings.length).toBe(1);
    expect(result.current[0].mappings[0].original).toBe("john@example.com");
    expect(result.current[0].maskInput).toBe("hello world");
    expect(result.current[0].activeTab).toBe("mask");
  });

  it('ロードしたデータのバージョンが異なる、または破損している場合はクリアして初期化すること', () => {
    const brokenData = {
      version: 99, // 未知のバージョン
      mappings: []
    };
    sessionStorage.setItem('cn_app_state', JSON.stringify(brokenData));

    const { result } = renderHook(() => usePersistedState());
    expect(result.current[0].version).toBe(1);
    expect(sessionStorage.getItem('cn_app_state')).toBeNull(); // 自動クリア
  });

  it('ロードしたデータのルートオブジェクトに未知のキーが含まれる場合は破損とみなして初期化すること (指摘3)', () => {
    const extraRootData = {
      ...validSavedData,
      extra_unknown_key: "some_value" // 未知キー
    };
    sessionStorage.setItem('cn_app_state', JSON.stringify(extraRootData));

    const { result } = renderHook(() => usePersistedState());
    expect(result.current[0].mappings.length).toBe(0); // デフォルト値で初期化
    expect(sessionStorage.getItem('cn_app_state')).toBeNull();
  });

  it('マッピング要素のoriginalが空文字など異常値の場合は破損とみなして初期化すること (要求事項2)', () => {
    const brokenOriginal = {
      ...validSavedData,
      mappings: [
        { tag: "[CN_EMAIL_0001]", original: "", category: "EMAIL", source: "AUTO" } // 空のoriginal
      ]
    };
    sessionStorage.setItem('cn_app_state', JSON.stringify(brokenOriginal));

    const { result } = renderHook(() => usePersistedState());
    expect(result.current[0].mappings.length).toBe(0); // デフォルト初期化されること
  });

  it('状態更新が正常にsessionStorageに同期されること', () => {
    const { result } = renderHook(() => usePersistedState());

    act(() => {
      result.current[1]({
        ...validSavedData,
        maskInput: 'updated input'
      });
    });

    expect(result.current[0].maskInput).toBe('updated input');
    const raw = sessionStorage.getItem('cn_app_state');
    expect(raw).toContain("updated input");
  });

  it('QuotaExceededErrorが発生した際、React Stateを変更せず以前のデータを維持(ロールバック)すること', () => {
    sessionStorage.setItem('cn_app_state', JSON.stringify(validSavedData));

    const { result } = renderHook(() => usePersistedState());
    expect(result.current[0].mappings[0].original).toBe("john@example.com");

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    setItemSpy.mockImplementation(() => {
      const err = new Error('The quota has been exceeded.');
      err.name = 'QuotaExceededError';
      throw err;
    });

    let updateResult: { success: boolean; error?: Error } | undefined;
    act(() => {
      updateResult = result.current[1]({
        ...validSavedData,
        maskInput: 'this should fail and rollback'
      });
    });

    expect(updateResult?.success).toBe(false);
    expect(updateResult?.error?.name).toBe('QuotaExceededError');

    // React State が更新されず、以前の状態を維持していること (ロールバック検証)
    expect(result.current[0].maskInput).toBe("hello world");
  });
});
