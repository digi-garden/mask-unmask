import { describe, it, expect } from 'vitest';
import {
  maskText,
  unmaskText,
  detectExistingTags,
  resolveConflicts,
  getNextTagNumber,
  syncMappings,
  MappingItem,
  DetectionMatch
} from './maskEngine';

describe('maskEngine', () => {

  describe('detectExistingTags', () => {
    it('既存のタグ形式が含まれている場合、trueを返すこと', () => {
      expect(detectExistingTags('これは [CN_EMAIL_0001] です')).toBe(true);
      expect(detectExistingTags('大文字小文字無視 [cn_apikey_1234]')).toBe(true);
      expect(detectExistingTags('余分なスペースあり [ cn_custom _ 0002 ]')).toBe(true);
    });

    it('タグ形式に似ているが不正な形式の場合はfalseを返すこと', () => {
      expect(detectExistingTags('これは [CN_CUSTOM_00010] です (5桁連番)')).toBe(false);
      expect(detectExistingTags('これは [CN_UNKNOWN_0001] です (未知カテゴリ)')).toBe(false);
      expect(detectExistingTags('これは [CN_CUSTOM-0001] です (ハイフン)')).toBe(false);
    });
  });

  describe('resolveConflicts', () => {
    it('競合解決のタイブレーク優先順位が正しく適用されること', () => {
      const matches: DetectionMatch[] = [
        { start: 0, end: 15, original: 'sk-proj-12345...', category: 'APIKEY', source: 'AUTO' },
        { start: 5, end: 15, original: '12345...', category: 'IPV4', source: 'AUTO' },
        { start: 5, end: 10, original: '12345', category: 'CUSTOM', source: 'CUSTOM' }
      ];

      const resolved = resolveConflicts(matches);
      expect(resolved.length).toBe(1);
      expect(resolved[0].source).toBe('CUSTOM');
    });
  });

  describe('getNextTagNumber', () => {
    it('カテゴリごとの最大連番+1を返すこと', () => {
      const mappings: MappingItem[] = [
        { tag: '[CN_EMAIL_0001]', original: 'a@a.com', category: 'EMAIL', source: 'AUTO' },
        { tag: '[CN_EMAIL_0003]', original: 'b@b.com', category: 'EMAIL', source: 'AUTO' },
        { tag: '[CN_IPV4_0001]', original: '1.1.1.1', category: 'IPV4', source: 'AUTO' }
      ];
      expect(getNextTagNumber(mappings, 'EMAIL')).toBe(4);
    });

    it('9999に達した際にエラーを投げること', () => {
      const mappings: MappingItem[] = [
        { tag: '[CN_EMAIL_9999]', original: 'a@a.com', category: 'EMAIL', source: 'AUTO' }
      ];
      expect(() => getNextTagNumber(mappings, 'EMAIL')).toThrow();
    });
  });

  describe('APIキーの厳密な検出範囲 (要求事項9 & 指摘1)', () => {
    const toggles = { APIKEY: true, IPV4: false, IPV6: false, EMAIL: false, PHONE: false };

    it('ghp_から始まる36文字の英数字に正確にマッチし、35文字や37文字は検出されないこと', () => {
      const ghp36 = 'ghp_' + 'a'.repeat(36);
      const ghp35 = 'ghp_' + 'a'.repeat(35);
      const ghp37 = 'ghp_' + 'a'.repeat(37);

      // 単独入力での除外検証
      const res35 = maskText(ghp35, [], toggles);
      expect(res35.newMappings.length).toBe(0);

      const res37 = maskText(ghp37, [], toggles);
      expect(res37.newMappings.length).toBe(0);

      const res36 = maskText(ghp36, [], toggles);
      expect(res36.newMappings.length).toBe(1);
      expect(res36.newMappings[0].original).toBe(ghp36);
    });

    it('前後に英数字が隣接している場合、部分一致として検出されないこと (境界条件保証)', () => {
      const validToken = 'ghp_' + '1'.repeat(36);
      const input = `abc${validToken}xyz や 9${validToken}9`;

      const { newMappings } = maskText(input, [], toggles);
      expect(newMappings.length).toBe(0);
    });

    it('AWSキー (AKIA16文字) についても部分一致せず完全境界一致のみを検出すること', () => {
      const validAws = 'AKIA' + 'A'.repeat(16);
      const invalidAws = 'AKIA' + 'A'.repeat(17);
      const embeddedAws = `abc${validAws}xyz`;

      expect(maskText(validAws, [], toggles).newMappings.length).toBe(1);
      expect(maskText(invalidAws, [], toggles).newMappings.length).toBe(0);
      expect(maskText(embeddedAws, [], toggles).newMappings.length).toBe(0);
    });

    it('大文字・小文字の表記揺れがある不正なトークン/キーは検出されないこと (要求事項1)', () => {
      // 1. 小文字のAWSアクセスキー (無効)
      const lowercaseAws = 'akia' + 'a'.repeat(16);
      expect(maskText(lowercaseAws, [], toggles).newMappings.length).toBe(0);

      // 2. 先頭大文字のGitHubトークン (無効)
      const uppercaseGithub = 'GHP_' + 'a'.repeat(36);
      expect(maskText(uppercaseGithub, [], toggles).newMappings.length).toBe(0);

      const mixedGithub = 'Ghp_' + 'a'.repeat(36);
      expect(maskText(mixedGithub, [], toggles).newMappings.length).toBe(0);

      // 3. 大文字のOpenAIキー (無効)
      const uppercaseOpenai = 'SK-PROJ-' + 'a'.repeat(40);
      expect(maskText(uppercaseOpenai, [], toggles).newMappings.length).toBe(0);
    });
  });

  describe('IPアドレスのポート・CIDR仮名化 (要求事項3 & 指摘2&3)', () => {
    const toggles = { APIKEY: false, IPV4: true, IPV6: true, EMAIL: false, PHONE: false };

    it('IPv4のポート番号およびCIDR表記を含めて仮名化すること', () => {
      const input = '接続先: 192.168.1.100:8080 と 10.0.0.1/24';
      const { maskedText, newMappings } = maskText(input, [], toggles);

      expect(maskedText).toBe('接続先: [CN_IPV4_0001] と [CN_IPV4_0002]');
      expect(newMappings[0].original).toBe('192.168.1.100:8080');
      expect(newMappings[1].original).toBe('10.0.0.1/24');
    });

    it('無効なポート(99999)や無効なCIDR(/99)の場合はIPアドレス部分のみを仮名化すること', () => {
      const input = 'IP: 192.168.1.100:99999 と 10.0.0.1/99';
      const { maskedText, newMappings } = maskText(input, [], toggles);

      // 無効なポート・CIDR部分は置換されずに元のテキストとして残る
      expect(maskedText).toBe('IP: [CN_IPV4_0001]:99999 と [CN_IPV4_0002]/99');
      expect(newMappings[0].original).toBe('192.168.1.100');
      expect(newMappings[1].original).toBe('10.0.0.1');
    });

    it('IPv6ゾーンIDおよび角括弧・ポートを個別に正しくパース・仮名化すること', () => {
      // 1. [2001:db8::1]:80
      const res1 = maskText('IPv6: [2001:db8::1]:80', [], toggles);
      expect(res1.maskedText).toBe('IPv6: [CN_IPV6_0001]');
      expect(res1.newMappings[0].original).toBe('[2001:db8::1]:80');

      // 2. fe80::1%eth0 (角括弧なし、ゾーンIDあり)
      const res2 = maskText('IPv6: fe80::1%eth0', [], toggles);
      expect(res2.maskedText).toBe('IPv6: [CN_IPV6_0001]');
      expect(res2.newMappings[0].original).toBe('fe80::1%eth0');

      // 3. [fe80::1%eth0]:80 (角括弧あり、ゾーンIDあり、ポートあり)
      const res3 = maskText('IPv6: [fe80::1%eth0]:80', [], toggles);
      expect(res3.maskedText).toBe('IPv6: [CN_IPV6_0001]');
      expect(res3.newMappings[0].original).toBe('[fe80::1%eth0]:80');
    });

    it('IPv6でポートが無効(99999)の場合は角括弧・ゾーンIDアドレスのみを仮名化すること', () => {
      const input = 'IPv6: [fe80::1%eth0]:99999';
      const { maskedText, newMappings } = maskText(input, [], toggles);

      expect(maskedText).toBe('IPv6: [CN_IPV6_0001]:99999');
      expect(newMappings[0].original).toBe('[fe80::1%eth0]');
    });

    it('不均衡な角括弧をもつIPv6は角括弧を含めて全体一致で仮名化されないこと (指摘2)', () => {
      // 1. 左括弧のみ [2001:db8::1 ➔ アドレス部分のみ置換され、左括弧は残る
      const res1 = maskText('IPv6: [2001:db8::1', [], toggles);
      expect(res1.maskedText).toBe('IPv6: [[CN_IPV6_0001]'); // [CN_IPV6_0001]
      expect(res1.newMappings[0].original).toBe('2001:db8::1');

      // 2. 右括弧のみ 2001:db8::1] ➔ アドレス部分のみ置換され、右括弧は残る
      const res2 = maskText('IPv6: 2001:db8::1]', [], toggles);
      expect(res2.maskedText).toBe('IPv6: [CN_IPV6_0001]]');
      expect(res2.newMappings[0].original).toBe('2001:db8::1');
    });
  });

  describe('既存タグ検出時の仮名化中断 (要求事項10)', () => {
    const toggles = { APIKEY: false, IPV4: true, IPV6: false, EMAIL: false, PHONE: false };

    it('既存のタグ形式が含まれる場合、Mask処理を中断し警告フラグを返すこと', () => {
      const input = 'IPは 192.168.1.1 ですが、既に [CN_IPV4_0001] が含まれています。';
      const { maskedText, newMappings, hasExistingTags } = maskText(input, [], toggles);

      expect(hasExistingTags).toBe(true);
      expect(newMappings.length).toBe(0);
      expect(maskedText).toBe(input); // 置換されないこと
    });
  });

  describe('空のoriginalに対する無限ループ防御 (要求事項2)', () => {
    const toggles = { APIKEY: false, IPV4: true, IPV6: false, EMAIL: false, PHONE: false };

    it('空文字列のoriginalを持つマッピングがあっても無限ループせず無視されること', () => {
      const mappings: MappingItem[] = [
        { tag: '[CN_CUSTOM_0001]', original: '', category: 'CUSTOM', source: 'CUSTOM' }
      ];
      const input = 'テストテキスト 192.168.1.1';
      const { maskedText, hasExistingTags } = maskText(input, mappings, toggles);

      expect(hasExistingTags).toBe(false);
      expect(maskedText).toBe('テストテキスト [CN_IPV4_0001]');
    });
  });

  describe('ユニーク復元件数の集計 (要求事項8)', () => {
    it('同一のタグが複数出現しても restoreCount はユニーク件数になること', () => {
      const mappings: MappingItem[] = [
        { tag: '[CN_EMAIL_0001]', original: 'john@example.com', category: 'EMAIL', source: 'AUTO' }
      ];
      const input = '[CN_EMAIL_0001] と [CN_EMAIL_0001] と [CN_EMAIL_0001]';
      const { unmaskedText, restoreCount } = unmaskText(input, mappings);

      expect(unmaskedText).toBe('john@example.com と john@example.com と john@example.com');
      expect(restoreCount).toBe(1); // 3回出ているがユニークなタグとしては1件
    });
  });

  describe('マップライフサイクル管理 (要求事項4)', () => {
    const toggles = { APIKEY: true, IPV4: true, IPV6: true, EMAIL: true, PHONE: true };

    it('トグルがOFFになったカテゴリのAUTOマップ項目は削除され、CUSTOM/IMPORTは保持されること', () => {
      const mappings: MappingItem[] = [
        { tag: '[CN_EMAIL_0001]', original: 'john@a.com', category: 'EMAIL', source: 'AUTO' },
        { tag: '[CN_IPV4_0001]', original: '1.1.1.1', category: 'IPV4', source: 'AUTO' },
        { tag: '[CN_CUSTOM_0001]', original: '社外秘', category: 'CUSTOM', source: 'CUSTOM' },
        { tag: '[CN_EMAIL_0002]', original: 'imported@a.com', category: 'EMAIL', source: 'IMPORT' }
      ];

      // EMAILトグルをOFFにする
      const nextToggles = { ...toggles, EMAIL: false };
      const updated = syncMappings('john@a.com 1.1.1.1', mappings, nextToggles);

      // AUTOのEMAILは削除される
      expect(updated.some(m => m.original === 'john@a.com')).toBe(false);
      // AUTOのIPV4はトグルONなので残る
      expect(updated.some(m => m.original === '1.1.1.1')).toBe(true);
      // CUSTOMのEMAILではないCUSTOMカテゴリ、およびIMPORTのEMAILは残る (保護対象)
      expect(updated.some(m => m.original === '社外秘')).toBe(true);
      expect(updated.some(m => m.original === 'imported@a.com')).toBe(true);
    });

    it('入力テキストから消えたAUTOマップ項目は削除されること', () => {
      const mappings: MappingItem[] = [
        { tag: '[CN_EMAIL_0001]', original: 'john@a.com', category: 'EMAIL', source: 'AUTO' },
        { tag: '[CN_IPV4_0001]', original: '1.1.1.1', category: 'IPV4', source: 'AUTO' }
      ];

      // テキストから john@a.com を消す
      const updated = syncMappings('1.1.1.1', mappings, toggles);

      expect(updated.some(m => m.original === 'john@a.com')).toBe(false);
      expect(updated.some(m => m.original === '1.1.1.1')).toBe(true);
    });
  });
});
