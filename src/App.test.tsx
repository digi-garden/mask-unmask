import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
import * as usePersistedStateHook from './hooks/usePersistedState';

describe('App Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('入力テキストの変更に伴い、入力から消えたAUTOマップが即座に同期・削除されること (指摘1&5)', async () => {
    render(<App />);

    const maskInput = screen.getByLabelText('仮名化元の入力テキスト') as HTMLTextAreaElement;

    // 1. 自動検出されるアドレスを入力
    fireEvent.change(maskInput, { target: { value: 'john@example.com' } });

    // debounceの500ms進める
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const outputText = screen.getByLabelText('仮名化後の出力テキスト') as HTMLTextAreaElement;
    expect(outputText.value).toBe('[CN_EMAIL_0001]');

    // 2. 入力からアドレスを消去
    fireEvent.change(maskInput, { target: { value: 'こんにちは' } });

    // debounceの500ms進める
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(outputText.value).toBe('こんにちは');

    // 置換マップ一覧内にタグが表示されていない（即座に同期削除されたこと）
    const items = screen.queryByText('[CN_EMAIL_0001]');
    expect(items).toBeNull();
  });

  it('トースト通知が3秒後に自動的に画面から消去されること (指摘5)', async () => {
    render(<App />);

    // 全クリアボタンをクリックしてトーストを発火させる
    const clearBtn = screen.getByRole('button', { name: '共通クリア (リセット)' });
    fireEvent.click(clearBtn);

    const confirmBtn = screen.getByRole('button', { name: 'クリア実行' });
    fireEvent.click(confirmBtn);

    // トースト出現の確認
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('すべてのデータと置換マップを消去しました');

    // 3秒 (3000ms) 時間を進める
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // トーストが消滅したことの確認
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ストレージの書き込み容量超過等で保存に失敗した場合にエラーメッセージがトースト通知されること (指摘4&5)', () => {
    // setState が QuotaExceededError を返すようにフックのモックを作成
    const mockSetState = vi.fn().mockReturnValue({
      success: false,
      error: new DOMException('QuotaExceededError', 'QuotaExceededError')
    });
    const mockClear = vi.fn();

    vi.spyOn(usePersistedStateHook, 'usePersistedState').mockReturnValue([
      {
        version: 1,
        mappings: [],
        maskInput: '',
        unmaskInput: '',
        detectionToggles: { APIKEY: true, IPV4: true, IPV6: true, EMAIL: true, PHONE: true },
        activeTab: 'mask'
      },
      mockSetState,
      mockClear
    ]);

    render(<App />);

    const maskInput = screen.getByLabelText('仮名化元の入力テキスト') as HTMLTextAreaElement;

    // 文字を入力して setState 実行を促す
    fireEvent.change(maskInput, { target: { value: 'a' } });

    // debounceの500ms進める
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // 容量超過エラーメッセージトーストが出現すること
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('エラー: セッションストレージ容量制限を超えたため、設定を保存できませんでした。');

    // 保存失敗時に、テキストエリア表示が直前の正常値 (空) へロールバックされていること (指摘2)
    expect(maskInput.value).toBe('');
  });

  it('499ms時点では出力が更新されず、500ms到達時に更新されること (非ブロッカー推奨テスト1)', () => {
    render(<App />);

    const maskInput = screen.getByLabelText('仮名化元の入力テキスト') as HTMLTextAreaElement;
    fireEvent.change(maskInput, { target: { value: 'john@example.com' } });

    // 499ms 進める (まだ更新されない)
    act(() => {
      vi.advanceTimersByTime(499);
    });

    const outputText = screen.getByLabelText('仮名化後の出力テキスト') as HTMLTextAreaElement;
    expect(outputText.value).toBe('');

    // あと 1ms 進めて 500ms 到着 (更新される)
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(outputText.value).toBe('[CN_EMAIL_0001]');
  });

  it('clearState() の removeItem() 失敗時にエラートーストが表示され、入力とマップが維持されること (非ブロッカー推奨テスト2)', () => {
    // clearState が失敗 (success: false) を返すようにモック
    const mockSetState = vi.fn().mockReturnValue({ success: true });
    const mockClear = vi.fn().mockReturnValue({
      success: false,
      error: new Error('Clear storage failed')
    });

    vi.spyOn(usePersistedStateHook, 'usePersistedState').mockReturnValue([
      {
        version: 1,
        mappings: [{ tag: '[CN_EMAIL_0001]', original: 'john@example.com', category: 'EMAIL', source: 'AUTO' }],
        maskInput: 'john@example.com',
        unmaskInput: '',
        detectionToggles: { APIKEY: true, IPV4: true, IPV6: true, EMAIL: true, PHONE: true },
        activeTab: 'mask'
      },
      mockSetState,
      mockClear
    ]);

    render(<App />);

    // 全クリアボタンをクリック
    const clearBtn = screen.getByRole('button', { name: '共通クリア (リセット)' });
    fireEvent.click(clearBtn);

    const confirmBtn = screen.getByRole('button', { name: 'クリア実行' });
    fireEvent.click(confirmBtn);

    // エラートーストが出現すること
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('エラー: データの消去に失敗しました。');

    // 入力およびマッピングがクリアされずに維持されていること
    const maskInput = screen.getByLabelText('仮名化元の入力テキスト') as HTMLTextAreaElement;
    expect(maskInput.value).toBe('john@example.com');
  });
});
