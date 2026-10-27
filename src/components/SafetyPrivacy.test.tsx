import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SafetyPrivacy } from './SafetyPrivacy';
import { APP_HOME_PATH } from '../paths';

describe('SafetyPrivacy Component', () => {
  const mockOnNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('「安全性とプライバシーについて」の主要セクションと共通利用規約の適用説明が表示されること', () => {
    render(<SafetyPrivacy onNavigate={mockOnNavigate} />);

    expect(screen.getByRole('heading', { name: '安全性とプライバシーについて' })).toBeDefined();
    expect(screen.getByRole('heading', { name: /1\. ブラウザ内での処理/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: /2\. データの保存/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: /3\. 通信と外部サービス/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: /4\. エクスポートデータの注意/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: /5\. 利用上の注意/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: /6\. 提供元情報・利用規約・プライバシーポリシー/ })).toBeDefined();

    // デジガーデン共通の「利用規約」が適用される旨が明記されていること
    expect(
      screen.getByText(/本ツールの利用条件および免責事項等については、デジガーデン共通の「利用規約」が適用されます。/)
    ).toBeDefined();

    // 旧暫定文言（別途整備予定）が残っていないこと
    expect(
      screen.queryByText(/正式な免責事項（利用規約や免責規定等）は別途整備予定です。/)
    ).toBeNull();
  });

  it('提供元公式サイト・利用規約・プライバシーポリシーへの外部リンクが安全属性付きで表示されること', () => {
    render(<SafetyPrivacy onNavigate={mockOnNavigate} />);

    const siteLink = screen.getByRole('link', { name: /デジガーデン 公式サイト/ });
    expect(siteLink.getAttribute('href')).toBe('https://digi-garden.com/');
    expect(siteLink.getAttribute('target')).toBe('_blank');
    expect(siteLink.getAttribute('rel')).toBe('noopener noreferrer');

    const termsLink = screen.getByRole('link', { name: /デジガーデン 利用規約/ });
    expect(termsLink.getAttribute('href')).toBe('https://digi-garden.com/terms/');
    expect(termsLink.getAttribute('target')).toBe('_blank');
    expect(termsLink.getAttribute('rel')).toBe('noopener noreferrer');

    const privacyLink = screen.getByRole('link', { name: /デジガーデン プライバシーポリシー/ });
    expect(privacyLink.getAttribute('href')).toBe('https://digi-garden.com/privacy/');
    expect(privacyLink.getAttribute('target')).toBe('_blank');
    expect(privacyLink.getAttribute('rel')).toBe('noopener noreferrer');
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
