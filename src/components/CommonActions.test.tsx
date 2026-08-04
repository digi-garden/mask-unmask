import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommonActions } from './CommonActions';
import { MappingItem } from '../utils/maskEngine';

describe('CommonActions Component', () => {
  const mockOnImport = vi.fn();
  const mockOnClearAll = vi.fn();
  const mockShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  const mappings: MappingItem[] = [
    { tag: '[CN_EMAIL_0001]', original: 'john@example.com', category: 'EMAIL', source: 'AUTO' }
  ];

  it('共通クリアボタン押下時に確認モーダルが開き、クリア確定で親のハンドラが呼ばれること (A11y/フォーカス制御)', () => {
    // native dialog showModal のスパイ
    const showModalSpy = vi.spyOn(HTMLDialogElement.prototype, 'showModal');

    render(
      <CommonActions
        mappings={mappings}
        onImportMappings={mockOnImport}
        onClearAll={mockOnClearAll}
        showToast={mockShowToast}
      />
    );

    const clearBtn = screen.getByRole('button', { name: '共通クリア (リセット)' });
    fireEvent.click(clearBtn);

    // ダイアログが開く (open属性が付与され、かつshowModalが実行されたこと)
    const dialog = screen.getByRole('dialog', { name: '共通クリア (リセット) の確認' });
    expect(dialog.getAttribute('open')).toBe('true');
    expect(showModalSpy).toHaveBeenCalled();

    // クリア実行
    const confirmBtn = screen.getByRole('button', { name: 'クリア実行' });
    fireEvent.click(confirmBtn);

    expect(mockOnClearAll).toHaveBeenCalled();
  });

  it('エクスポートボタン押下時に注意ダイアログが開き、同意してダウンロードが開始されること', () => {
    render(
      <CommonActions
        mappings={mappings}
        onImportMappings={mockOnImport}
        onClearAll={mockOnClearAll}
        showToast={mockShowToast}
      />
    );

    const exportBtn = screen.getByRole('button', { name: 'マップエクスポート' });
    fireEvent.click(exportBtn);

    const dialog = screen.getByRole('dialog', { name: 'マップエクスポートの確認' });
    expect(dialog.getAttribute('open')).toBe('true');

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const confirmBtn = screen.getByRole('button', { name: '同意してエクスポート' });
    fireEvent.click(confirmBtn);

    expect(clickSpy).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('エクスポートをダウンロードしました'));
  });

  it('マッピングのインポートが成功しストレージ保存が完了した場合にのみ成功トーストが表示されること (指摘4&5)', async () => {
    mockOnImport.mockReturnValue(true); // インポート成功

    render(
      <CommonActions
        mappings={mappings}
        onImportMappings={mockOnImport}
        onClearAll={mockOnClearAll}
        showToast={mockShowToast}
      />
    );

    const fileInput = screen.getByLabelText('マッピングファイルをインポート') as HTMLInputElement;

    const importJSON = JSON.stringify({
      version: "1.0",
      createdAt: "2026-07-31T05:00:00Z",
      mappings: [
        { tag: "[CN_EMAIL_0002]", original: "imported@domain.com", category: "EMAIL" }
      ]
    });
    const file = new File([importJSON], 'import.json', { type: 'application/json' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: 'マップインポートのプレビュー' });
      expect(dialog.getAttribute('open')).toBe('true');
    });

    const confirmBtn = screen.getByRole('button', { name: 'インポート確定' });
    fireEvent.click(confirmBtn);

    expect(mockOnImport).toHaveBeenCalled();
    // 成功トーストの表示
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('マップをインポートしました'));
  });

  it('インポート適用時のストレージ保存に失敗した場合はインポート成功トーストが表示されないこと (指摘4&5)', async () => {
    mockOnImport.mockReturnValue(false); // 保存容量超過等でインポート失敗

    render(
      <CommonActions
        mappings={mappings}
        onImportMappings={mockOnImport}
        onClearAll={mockOnClearAll}
        showToast={mockShowToast}
      />
    );

    const fileInput = screen.getByLabelText('マッピングファイルをインポート') as HTMLInputElement;

    const importJSON = JSON.stringify({
      version: "1.0",
      createdAt: "2026-07-31T05:00:00Z",
      mappings: [
        { tag: "[CN_EMAIL_0002]", original: "imported@domain.com", category: "EMAIL" }
      ]
    });
    const file = new File([importJSON], 'import.json', { type: 'application/json' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: 'マップインポートのプレビュー' });
      expect(dialog.getAttribute('open')).toBe('true');
    });

    const confirmBtn = screen.getByRole('button', { name: 'インポート確定' });
    fireEvent.click(confirmBtn);

    expect(mockOnImport).toHaveBeenCalled();
    // 成功トーストは呼び出されないこと
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});
