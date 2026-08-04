import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MaskTab } from './MaskTab';
import { MappingItem } from '../utils/maskEngine';

describe('MaskTab Component', () => {
  const defaultToggles = { APIKEY: true, IPV4: true, IPV6: true, EMAIL: true, PHONE: true };
  const mockOnChangeInput = vi.fn();
  const mockOnUpdateMappings = vi.fn();
  const mockOnChangeToggles = vi.fn();
  const mockOnUpdateExcludeList = vi.fn();
  const mockShowToast = vi.fn();
  const mockOnNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('入力テキストに沿って仮名化結果が即座に描画され、新規検出されたタグが更新ハンドラへ流れること', () => {
    render(
      <MaskTab
        value="接続元 192.168.1.1"
        inputText="接続元 192.168.1.1"
        onChangeInputText={mockOnChangeInput}
        mappings={[]}
        onUpdateMappings={mockOnUpdateMappings}
        toggles={defaultToggles}
        onChangeToggles={mockOnChangeToggles}
        excludeList={[]}
        onUpdateExcludeList={mockOnUpdateExcludeList}
        showToast={mockShowToast}
        onNavigate={mockOnNavigate}
      />
    );

    const outputArea = screen.getByLabelText('仮名化後の出力テキスト') as HTMLTextAreaElement;
    expect(outputArea.value).toBe('接続元 [CN_IPV4_0001]');

    expect(mockOnUpdateMappings).toHaveBeenCalled();
  });

  it('入力変更時、UI状態側の一時除外リストクリアハンドラが呼ばれること (要求事項7 & 指摘5)', () => {
    render(
      <MaskTab
        value="1.1.1.1"
        inputText="1.1.1.1"
        onChangeInputText={mockOnChangeInput}
        mappings={[]}
        onUpdateMappings={mockOnUpdateMappings}
        toggles={defaultToggles}
        onChangeToggles={mockOnChangeToggles}
        excludeList={['1.1.1.1']} // 除外リストに要素あり
        onUpdateExcludeList={mockOnUpdateExcludeList}
        showToast={mockShowToast}
        onNavigate={mockOnNavigate}
      />
    );

    const inputArea = screen.getByLabelText('仮名化元の入力テキスト') as HTMLTextAreaElement;

    // 入力を変更
    fireEvent.change(inputArea, { target: { value: '1.1.1.12' } });

    expect(mockOnChangeInput).toHaveBeenCalledWith('1.1.1.12');
    // 除外リストクリアが呼ばれたことの確認
    expect(mockOnUpdateExcludeList).toHaveBeenCalledWith([]);
  });

  it('モバイル表示でも置換マップ一覧が表示される構造クラスが適用されていること (指摘2 & 5)', () => {
    render(
      <MaskTab
        value=""
        inputText=""
        onChangeInputText={mockOnChangeInput}
        mappings={[]}
        onUpdateMappings={mockOnUpdateMappings}
        toggles={defaultToggles}
        onChangeToggles={mockOnChangeToggles}
        excludeList={[]}
        onUpdateExcludeList={mockOnUpdateExcludeList}
        showToast={mockShowToast}
        onNavigate={mockOnNavigate}
      />
    );

    // 置換マップ一覧を囲む親コンテナ要素
    const listHeader = screen.getByRole('heading', { name: /置換マップ一覧/ });
    const listContainer = listHeader.closest('.md\\:col-span-2');

    expect(listContainer).toBeDefined();
    // モバイルでも表示されるように "hidden" クラスが適用されていないこと
    expect(listContainer?.className).not.toContain('hidden');
  });

  it('textareaでのドラッグ選択を検知してカスタム登録入力フィールドに自動転記されること (要求事項1)', () => {
    render(
      <MaskTab
        value="個人データ 社外秘テキストが含まれる"
        inputText="個人データ 社外秘テキストが含まれる"
        onChangeInputText={mockOnChangeInput}
        mappings={[]}
        onUpdateMappings={mockOnUpdateMappings}
        toggles={defaultToggles}
        onChangeToggles={mockOnChangeToggles}
        excludeList={[]}
        onUpdateExcludeList={mockOnUpdateExcludeList}
        showToast={mockShowToast}
        onNavigate={mockOnNavigate}
      />
    );

    const inputArea = screen.getByLabelText('仮名化元の入力テキスト') as HTMLTextAreaElement;

    inputArea.selectionStart = 6;
    inputArea.selectionEnd = 9;

    fireEvent.select(inputArea);

    const customOriginalInput = screen.getByLabelText('元のテキスト (ドラッグ選択または直接入力)') as HTMLInputElement;
    expect(customOriginalInput.value).toBe('社外秘');
  });

  it('コピー失敗時に出力テキストエリアが全選択状態になり手動コピーを促すこと (要求事項3)', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true
    });

    render(
      <MaskTab
        value="1.1.1.1"
        inputText="1.1.1.1"
        onChangeInputText={mockOnChangeInput}
        mappings={[{ tag: '[CN_IPV4_0001]', original: '1.1.1.1', category: 'IPV4', source: 'AUTO' }]}
        onUpdateMappings={mockOnUpdateMappings}
        toggles={defaultToggles}
        onChangeToggles={mockOnChangeToggles}
        excludeList={[]}
        onUpdateExcludeList={mockOnUpdateExcludeList}
        showToast={mockShowToast}
        onNavigate={mockOnNavigate}
      />
    );


    const copyBtn = screen.getByRole('button', { name: 'コピー (Copy)' });
    const outputArea = screen.getByLabelText('仮名化後の出力テキスト') as HTMLTextAreaElement;
    const selectSpy = vi.spyOn(outputArea, 'select');

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('表示されたテキストを手動でコピーしてください'));
    expect(selectSpy).toHaveBeenCalled();
  });

  it('個別削除ボタン押下時に置換マップから削除され、一時除外リストへ登録されること', () => {
    const mappings: MappingItem[] = [
      { tag: '[CN_EMAIL_0001]', original: 'a@a.com', category: 'EMAIL', source: 'AUTO' }
    ];

    render(
      <MaskTab
        value="a@a.com"
        inputText="a@a.com"
        onChangeInputText={mockOnChangeInput}
        mappings={mappings}
        onUpdateMappings={mockOnUpdateMappings}
        toggles={defaultToggles}
        onChangeToggles={mockOnChangeToggles}
        excludeList={[]}
        onUpdateExcludeList={mockOnUpdateExcludeList}
        showToast={mockShowToast}
        onNavigate={mockOnNavigate}
      />
    );

    const deleteBtns = screen.getAllByRole('button', { name: '[CN_EMAIL_0001] マッピングを削除' });
    fireEvent.click(deleteBtns[0]);

    expect(mockOnUpdateExcludeList).toHaveBeenCalledWith(['a@a.com']);
    expect(mockOnUpdateMappings).toHaveBeenCalledWith([]);
  });

  it('入力欄をスクロールした際、出力欄のスクロール位置が比率に応じて同期して更新されること (指摘1)', () => {
    render(
      <MaskTab
        value="a"
        inputText="a"
        onChangeInputText={mockOnChangeInput}
        mappings={[]}
        onUpdateMappings={mockOnUpdateMappings}
        toggles={defaultToggles}
        onChangeToggles={mockOnChangeToggles}
        excludeList={[]}
        onUpdateExcludeList={mockOnUpdateExcludeList}
        showToast={mockShowToast}
        onNavigate={mockOnNavigate}
      />
    );

    const inputArea = screen.getByLabelText('仮名化元の入力テキスト') as HTMLTextAreaElement;
    const outputArea = screen.getByLabelText('仮名化後の出力テキスト') as HTMLTextAreaElement;

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
