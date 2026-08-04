import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UnmaskTab } from './UnmaskTab';
import { MappingItem } from '../utils/maskEngine';

describe('UnmaskTab Component', () => {
  const mockOnChangeInput = vi.fn();
  const mockShowToast = vi.fn();
  const mockOnNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mappings: MappingItem[] = [
    { tag: '[CN_EMAIL_0001]', original: 'john@example.com', category: 'EMAIL', source: 'AUTO' }
  ];

  it('入力された仮名化タグが mappings に基づいて正しく復元されサマリーに描画されること (500ms後)', () => {
    render(
      <UnmaskTab
        value="接続ユーザー: [CN_EMAIL_0001]"
        inputText="接続ユーザー: [CN_EMAIL_0001]"
        onChangeInputText={mockOnChangeInput}
        mappings={mappings}
        showToast={mockShowToast}
        onNavigate={mockOnNavigate}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const outputArea = screen.getByLabelText('復元後の出力テキスト') as HTMLTextAreaElement;
    expect(outputArea.value).toBe('接続ユーザー: john@example.com');

    const summaryCount = screen.getByText('1 件');
    expect(summaryCount).toBeDefined();
  });

  it('置換マップに存在しない未復元タグがある場合、未復元タグ一覧としてバッジ描画されること (500ms後)', () => {
    render(
      <UnmaskTab
        value="未復元: [CN_EMAIL_0002] と [CN_EMAIL_0001]"
        inputText="未復元: [CN_EMAIL_0002] と [CN_EMAIL_0001]"
        onChangeInputText={mockOnChangeInput}
        mappings={mappings}
        showToast={mockShowToast}
        onNavigate={mockOnNavigate}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const unrecoveredBadge = screen.getByText('[CN_EMAIL_0002]');
    expect(unrecoveredBadge).toBeDefined();

    expect(screen.queryByText('[CN_EMAIL_0001]')).toBeNull();
  });

  it('コピー失敗時、クリップボードAPI失敗に伴うテキスト全選択処理が発火すること (500ms後)', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true
    });

    render(
      <UnmaskTab
        value="[CN_EMAIL_0001]"
        inputText="[CN_EMAIL_0001]"
        onChangeInputText={mockOnChangeInput}
        mappings={mappings}
        showToast={mockShowToast}
        onNavigate={mockOnNavigate}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const copyBtn = screen.getByRole('button', { name: 'コピー (Copy)' });
    const outputArea = screen.getByLabelText('復元後の出力テキスト') as HTMLTextAreaElement;
    const selectSpy = vi.spyOn(outputArea, 'select');

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('手動でコピーしてください'));
    expect(selectSpy).toHaveBeenCalled();
  });

  it('入力欄をスクロールした際、出力欄のスクロール位置が比率に応じて同期して更新されること (指摘1)', () => {
    render(
      <UnmaskTab
        value="[CN_EMAIL_0001]"
        inputText="[CN_EMAIL_0001]"
        onChangeInputText={mockOnChangeInput}
        mappings={mappings}
        showToast={mockShowToast}
        onNavigate={mockOnNavigate}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const inputArea = screen.getByLabelText('復元元の入力テキスト (仮名化タグを含むテキスト)') as HTMLTextAreaElement;
    const outputArea = screen.getByLabelText('復元後の出力テキスト') as HTMLTextAreaElement;

    // スクロール関連のプロパティをモック定義
    Object.defineProperty(inputArea, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(inputArea, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(outputArea, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(outputArea, 'clientHeight', { configurable: true, value: 200 });

    // 入力欄をスクロール (200px)
    inputArea.scrollTop = 200;
    fireEvent.scroll(inputArea);

    // 最大スクロール距離: 入力 800px (1000 - 200), 出力 300px (500 - 200)
    // スクロール比率: 200 / 800 = 0.25
    // 期待される出力のscrollTop: 300 * 0.25 = 75px
    expect(outputArea.scrollTop).toBe(75);

    // 【検証】同期によって発生した出力側のスクロールイベントが、入力側へ逆流同期（無限ループ）しないこと (指摘1)
    // 出力側の scroll イベントを発火
    outputArea.scrollTop = 75; // 同期によって設定された値
    fireEvent.scroll(outputArea);

    // 入力側の scrollTop は 200px のまま変化しないこと
    expect(inputArea.scrollTop).toBe(200);

    // 【検証】ユーザーが短い間隔で連続スクロールを行っても遮断されず即座に追従すること (カクつき防止)
    inputArea.scrollTop = 400;
    fireEvent.scroll(inputArea);
    expect(outputArea.scrollTop).toBe(150);

    inputArea.scrollTop = 600;
    fireEvent.scroll(inputArea);
    expect(outputArea.scrollTop).toBe(225);
  });
});
