import css from '../styles.css' with { loader: 'text' };
import { contrastRatio } from './library/format-badge.component';

// The colour tokens of src/styles.css, light and dark, checked against the pairs the app really draws.

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2].toLowerCase()]));
}

// dark tokens twice: for a system that is dark (unless Light was chosen), and for Dark chosen on a light system
const dark = css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/)![1];
const darkChosen = css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/)![1];
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

describe('toggle buttons', () => {
  it('are outlined while off and filled with the accent while on', () => {
    expect(css).toMatch(/button\.toggle\s*\{[^}]*background:\s*transparent[^}]*border:\s*2px solid var\(--accent\)/);
    expect(css).toMatch(/button\.toggle\[aria-pressed='true'\]\s*\{[^}]*background:\s*var\(--accent\)[^}]*color:\s*var\(--on-accent\)/);
  });
});

describe('theme colours', () => {
  it('Dark chosen and a dark system use the very same colours', () => {
    expect(tokens(darkChosen)).toEqual(tokens(dark));
  });

  it('a chosen Light theme keeps the light tokens on a dark system and says so to the browser', () => {
    expect(css).toMatch(/:root\[data-theme="light"\]\s*\{[^}]*color-scheme:\s*light/);
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark/);
    // the media block must not apply when Light was chosen
    expect(css).toContain(':root:not([data-theme="light"])');
  });

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
