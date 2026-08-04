import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabContainer } from './TabContainer';

describe('TabContainer Component', () => {
  it('WAI-ARIAのロールや現在の活性タブ状態が正しくバインドされていること (A11y)', () => {
    const onChangeTab = vi.fn();
    render(<TabContainer activeTab="mask" onChangeTab={onChangeTab} />);

    const maskTab = screen.getByRole('tab', { name: '仮名化 (Mask)' });
    const unmaskTab = screen.getByRole('tab', { name: '元データ復元 (Unmask)' });

    expect(maskTab.getAttribute('aria-selected')).toBe('true');
    expect(maskTab.getAttribute('tabIndex')).toBe('0');

    expect(unmaskTab.getAttribute('aria-selected')).toBe('false');
    expect(unmaskTab.getAttribute('tabIndex')).toBe('-1');
  });

  it('クリックした際に対象のタブへ切り替えハンドラが発火すること', () => {
    const onChangeTab = vi.fn();
    render(<TabContainer activeTab="mask" onChangeTab={onChangeTab} />);

    const unmaskTab = screen.getByRole('tab', { name: '元データ復元 (Unmask)' });
    fireEvent.click(unmaskTab);

    expect(onChangeTab).toHaveBeenCalledWith('unmask');
  });

  it('左右の矢印キー入力で隣のタブへ活性選択が切り替わること (キーボード操作)', () => {
    const onChangeTab = vi.fn();
    render(<TabContainer activeTab="mask" onChangeTab={onChangeTab} />);

    const maskTab = screen.getByRole('tab', { name: '仮名化 (Mask)' });

    // 右矢印キーの押下
    fireEvent.keyDown(maskTab, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(onChangeTab).toHaveBeenCalledWith('unmask');

    // 左矢印キーの押下
    fireEvent.keyDown(maskTab, { key: 'ArrowLeft', code: 'ArrowLeft' });
    expect(onChangeTab).toHaveBeenCalledWith('unmask');
  });
});
