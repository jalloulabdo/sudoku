import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');

function tokens(selector: string): Record<string, string> {
  const block = new RegExp(`(^|\\n)${selector.replace('.', '\\.')}\\s*{([^}]*)}`).exec(css)?.[2] ?? '';
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [16, 8, 0].map((s) => {
    const c = ((n >> s) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every foreground/background combination the UI renders. */
const CELL_BACKGROUNDS = ['surface', 'cell-peer', 'cell-same', 'cell-selected', 'cell-conflict', 'hint-focus', 'hint-target'];
const PAIRS: [string, string][] = [
  ...CELL_BACKGROUNDS.flatMap((bg) => ['given', 'entry', 'error'].map((fg) => [fg, bg] as [string, string])),
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  ['text', 'hint-focus'],
  ['text', 'hint-target'],
  ['text', 'cell-peer'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surface-2'],
  ['entry', 'surface-2'],
  ['entry', 'cell-same'],
  ['error', 'cell-conflict'],
  ['accent-fg', 'accent'],
  // Home page: white text on the brand gradient, and gradient text on the page background.
  ['accent-fg', 'brand-a'],
  ['accent-fg', 'brand-b'],
  ['brand-text-a', 'bg'],
  ['brand-text-b', 'bg'],
];

describe('WCAG AA contrast', () => {
  for (const theme of [':root', '.dark']) {
    it(`all text pairs reach 4.5:1 in ${theme}`, () => {
      const t = tokens(theme);
      expect(Object.keys(t).length).toBeGreaterThan(15);
      const failures = PAIRS.filter(([fg, bg]) => contrast(t[fg], t[bg]) < 4.5).map(
        ([fg, bg]) => `${fg} on ${bg}: ${contrast(t[fg], t[bg]).toFixed(2)}`,
      );
      expect(failures).toEqual([]);
    });
  }
});
