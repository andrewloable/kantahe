import css from '../styles.css' with { loader: 'text' };
import { contrastRatio } from './library/format-badge.component';

// The colour tokens of src/styles.css, light and dark, checked against the pairs the app really draws.

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2].toLowerCase()]));
}

const dark = css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/)![1];
const light = css.match(/:root\s*\{([^}]*)\}/)![1];
const themes = { light: tokens(light), dark: { ...tokens(light), ...tokens(dark) } };

// [foreground token, background token, minimum ratio]: 4.5 for text, 3 for large text and symbols
const PAIRS: [string, string, number][] = [
  ['text', 'paper', 4.5],
  ['text', 'panel', 4.5],
  ['muted', 'paper', 4.5],
  ['muted', 'panel', 4.5],
  ['accent', 'paper', 4.5],
  ['accent', 'panel', 4.5],
  ['on-accent', 'accent', 4.5],
  ['danger', 'paper', 4.5],
  ['danger', 'panel', 4.5],
  ['sung', 'paper', 3],
  ['sung', 'panel', 3],
];

describe('theme colours', () => {
  for (const [name, t] of Object.entries(themes)) {
    for (const [fg, bg, min] of PAIRS) {
      it(`${name}: ${fg} on ${bg} has a contrast of at least ${min}:1`, () => {
        expect(t[fg], `${fg} is defined`).toBeDefined();
        expect(t[bg], `${bg} is defined`).toBeDefined();
        expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
      });
    }
  }
});
