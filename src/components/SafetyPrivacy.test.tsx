import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SafetyPrivacy } from './SafetyPrivacy';
import { APP_HOME_PATH } from '../paths';

describe('SafetyPrivacy Component', () => {
  const mockOnNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('「安全性とプライバシーについて」の主要セクションと現行の免責事項説明が表示されること', () => {
    render(<SafetyPrivacy onNavigate={mockOnNavigate} />);

    expect(screen.getByRole('heading', { name: '安全性とプライバシーについて' })).toBeDefined();
    expect(screen.getByRole('heading', { name: /1\. ブラウザ内での処理/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: /2\. データの保存/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: /3\. 通信と外部サービス/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: /4\. エクスポートデータの注意/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: /5\. 利用上の注意/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: /6\. 提供元情報とプライバシーポリシー/ })).toBeDefined();

    // DG-02未承認のため、利用規約適用文言ではなく現行の整備予定文言が維持されていること
    expect(
      screen.getByText(/正式な免責事項（利用規約や免責規定等）は別途整備予定です。/)
    ).toBeDefined();
  });

  it('提供元公式サイトおよびプライバシーポリシーへの外部リンクが安全属性付きで表示され、未承認の利用規約リンクが含まれないこと', () => {
    render(<SafetyPrivacy onNavigate={mockOnNavigate} />);

    const siteLink = screen.getByRole('link', { name: /デジガーデン 公式サイト/ });
    expect(siteLink.getAttribute('href')).toBe('https://digi-garden.com/');
    expect(siteLink.getAttribute('target')).toBe('_blank');
    expect(siteLink.getAttribute('rel')).toBe('noopener noreferrer');

    const privacyLink = screen.getByRole('link', { name: /デジガーデン プライバシーポリシー/ });
    expect(privacyLink.getAttribute('href')).toBe('https://digi-garden.com/privacy/');
    expect(privacyLink.getAttribute('target')).toBe('_blank');
    expect(privacyLink.getAttribute('rel')).toBe('noopener noreferrer');

    // DG-02未承認のため https://digi-garden.com/terms/ へのリンクは存在しないこと
    const allLinks = screen.getAllByRole('link');
    for (const link of allLinks) {
      expect(link.getAttribute('href')).not.toBe('https://digi-garden.com/terms/');
    }
  });

  it('パンくずの「ホーム」および下部の「ツールに戻る」ボタンでホームパスへ遷移できること', () => {
    render(<SafetyPrivacy onNavigate={mockOnNavigate} />);

    const homeBtn = screen.getByRole('button', { name: 'ホーム' });
    fireEvent.click(homeBtn);
    expect(mockOnNavigate).toHaveBeenCalledWith(APP_HOME_PATH);

    mockOnNavigate.mockClear();

    const backBtn = screen.getByRole('button', { name: 'ツールに戻る' });
    fireEvent.click(backBtn);
    expect(mockOnNavigate).toHaveBeenCalledWith(APP_HOME_PATH);
  });
});
