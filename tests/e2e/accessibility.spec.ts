import { test, expect, type Page } from '@playwright/test';

type ContrastObservation = { foreground: string; background: string; ratio: number };

async function observeContrast(page: Page, selector: string): Promise<ContrastObservation> {
  return page.locator(selector).evaluate((element) => {
    type RGBA = [number, number, number, number];
    const parse = (value: string): RGBA => {
      const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/);
      if (!match) throw new Error(`Unexpected CSS color: ${value}`);
      return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
    };
    const composite = (front: RGBA, back: RGBA): RGBA => {
      const a = front[3] + back[3] * (1 - front[3]);
      if (a === 0) return [0, 0, 0, 0];
      return [
        (front[0] * front[3] + back[0] * back[3] * (1 - front[3])) / a,
        (front[1] * front[3] + back[1] * back[3] * (1 - front[3])) / a,
        (front[2] * front[3] + back[2] * back[3] * (1 - front[3])) / a,
        a,
      ];
    };
    const ancestors: Element[] = [];
    let current: Element | null = element;
    while (current) {
      ancestors.unshift(current);
      current = current.parentElement;
    }
    let background: RGBA = [255, 255, 255, 1];
    for (const ancestor of ancestors) {
      background = composite(parse(getComputedStyle(ancestor).backgroundColor), background);
    }
    const foreground = composite(parse(getComputedStyle(element).color), background);
    const luminance = (rgb: RGBA) => {
      const channels = rgb.slice(0, 3).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const fg = luminance(foreground);
    const bg = luminance(background);
    return {
      foreground: getComputedStyle(element).color,
      background: background.map((component) => Math.round(component)).join(', '),
      ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
    };
  });
}

for (const width of [375, 1280]) {
  test(`rendered text contrast meets WCAG AA at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/mask-unmask/');
    const selectors = [
      '#panel-mask >> text=現在、仮名化されたデータはありません',
      'button:has-text("共通クリア (リセット)")',
      'footer > p:first-child',
    ];
    for (const selector of selectors) {
      const locator = page.locator(selector);
      await expect(locator).toBeVisible();
      const result = await observeContrast(page, selector);
      expect(
        result.ratio,
        `${selector}: foreground=${result.foreground} background=${result.background} ratio=${result.ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
}

for (const path of ['/mask-unmask/', '/mask-unmask/safety-and-privacy']) {
  test(`visible heading hierarchy has no skipped levels: ${path}`, async ({ page }) => {
    await page.goto(path);
    const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((elements) =>
      elements
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden'
            && element.getClientRects().length > 0;
        })
        .map((element) => Number(element.tagName.charAt(1))),
    );
    expect(levels[0], 'First visible heading must be h1').toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i], `Heading order: ${levels.join(' > ')}`).toBeLessThanOrEqual(levels[i - 1] + 1);
    }
  });
}
