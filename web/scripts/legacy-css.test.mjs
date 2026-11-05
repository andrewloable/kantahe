// Tests of web/legacy/legacy.css (kantahe-org.7): fallbacks for the CSS of the player page that Chromium 74 does not know. The page is
// /embed/player: player-view, lyrics-view, score-screen, background-video and the toasts. A declaration that an engine does not know is
// dropped, so `font-size: clamp(...)` leaves the text at the default size; every use of a newer feature in those files must have a rule here.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildLegacy, LEGACY_MIN_CHROMIUM } from './build-legacy.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = readFileSync(join(WEB, 'legacy', 'legacy.css'), 'utf8');

// Chromium versions: flex gap 84, inset 87, min() max() clamp() 79. Each row: the file, what it uses, how often, and the rule that stands in for it.
const ROWS = [
  { file: 'src/app/player/player-view.component.ts', use: 'gap', count: 3, fallback: /html\.legacy \.topbar[^{]*\{[^}]*margin-left/s, why: '.topbar' },
  { file: 'src/app/player/player-view.component.ts', use: 'gap', count: 3, fallback: /html\.legacy \.song p[^{]*\{[^}]*margin-left/s, why: '.song p' },
  { file: 'src/app/player/player-view.component.ts', use: 'gap', count: 3, fallback: /html\.legacy \.controls[^{]*\{[^}]*margin/s, why: '.controls' },
  { file: 'src/app/player/player-view.component.ts', use: 'clamp', count: 2, fallback: /html\.legacy app-lyrics-view\s*\{[^}]*font-size:\s*7vmin/s, why: 'app-lyrics-view font-size' },
  { file: 'src/app/player/player-view.component.ts', use: 'clamp', count: 2, fallback: /html\.legacy \.song h1\s*\{[^}]*font-size/s, why: 'h1 font-size' },
  { file: 'src/app/player/player-view.component.ts', use: 'max', count: 1, fallback: /html\.legacy \.stage\.embedded\s*\{[^}]*padding-bottom:\s*calc\(var\(--native-controls/s, why: '.stage.embedded padding-bottom' },
  { file: 'src/app/player/player-view.component.ts', use: 'min', count: 1, fallback: /html\.legacy progress\s*\{[^}]*max-width:\s*40rem/s, why: 'progress width' },
  { file: 'src/app/player/lyrics-view/lyrics-view.component.ts', use: 'clamp', count: 1, fallback: /html\.legacy app-lyrics-view\s*\{[^}]*font-size/s, why: ':host font-size (the player sets the size too)' },
  { file: 'src/app/player/lyrics-view/lyrics-view.component.ts', use: 'gap', count: 1, fallback: /html\.legacy \.dots[^{]*\{[^}]*margin-left/s, why: '.dots' },
  { file: 'src/app/player/score/score-screen.component.ts', use: 'inset', count: 1, fallback: /html\.legacy \.overlay[^{]*\{[^}]*top:\s*0[^}]*left:\s*0/s, why: '.overlay' },
  { file: 'src/app/player/score/score-screen.component.ts', use: 'clamp', count: 2, fallback: /html\.legacy \.number\s*\{[^}]*font-size/s, why: '.number font-size' },
  { file: 'src/app/player/score/score-screen.component.ts', use: 'clamp', count: 2, fallback: /html\.legacy \.comment\s*\{[^}]*font-size/s, why: '.comment font-size' },
  { file: 'src/app/player/background/background-video.component.ts', use: 'inset', count: 3, fallback: /html\.legacy \.layer[^{]*\{[^}]*top:\s*0[^}]*left:\s*0/s, why: '.layer, .v, .scrim' },
  { file: 'src/app/core/toasts.component.ts', use: 'gap', count: 2, fallback: /html\.legacy \.toasts[^{]*\{[^}]*margin-top/s, why: '.toasts' },
  { file: 'src/app/core/toasts.component.ts', use: 'gap', count: 2, fallback: /html\.legacy \.toast[^{s]*\{[^}]*margin-left/s, why: '.toast' },
  { file: 'src/app/core/toasts.component.ts', use: 'min', count: 1, fallback: /html\.legacy \.toast\s*\{[^}]*max-width:\s*28rem/s, why: '.toast max-width' },
];

const PATTERNS = {
  gap: /(?:^|[\s;{])gap:/gm,
  inset: /(?:^|[\s;{])inset:/gm,
  clamp: /clamp\(/g,
  min: /(?:^|[^.\w-])min\(/g,
  max: /(?:^|[^.\w-])max\(/g,
};

/** The text of the `styles:` template of a component file. */
function styles(file) {
  const m = /styles:\s*`([\s\S]*?)`\s*,?\s*\}\)/.exec(readFileSync(join(WEB, file), 'utf8'));
  return m ? m[1] : '';
}

test('every use of a newer CSS feature in the player files is the one this file knows about (a new use needs a new fallback)', () => {
  const files = [...new Set(ROWS.map((r) => r.file))];
  for (const file of files) {
    const css = styles(file);
    for (const [use, pattern] of Object.entries(PATTERNS)) {
      const actual = (css.match(pattern) ?? []).length;
      const expected = Math.max(0, ...ROWS.filter((r) => r.file === file && r.use === use).map((r) => r.count));
      assert.equal(actual, expected, `${file}: ${use} is used ${actual} times, the list says ${expected}: add the fallback to legacy/legacy.css and a row here`);
    }
  }
});

test('the files with newer CSS that are not in the list do not use it (embed page)', () => {
  assert.equal(Object.values(PATTERNS).map((p) => (styles('src/app/player/embed-player.page.ts').match(p) ?? []).length).reduce((a, b) => a + b, 0), 0);
});

test('every use has its fallback rule, under html.legacy', () => {
  for (const row of ROWS) assert.match(CSS, row.fallback, `no fallback for ${row.why} (${row.use}) in ${row.file}`);
});

test('every rule of the stylesheet is scoped under html.legacy, so that a modern engine would not change', () => {
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').replace(/\}\s*\}/g, '}');
  for (const selector of rules.split('}').map((r) => r.split('{')[0].trim()).filter(Boolean)) {
    for (const part of selector.split(',')) assert.match(part.trim(), /^html\.legacy\b/, `unscoped selector: ${part.trim()}`);
  }
});

test('the legacy page has class legacy on <html> and links the stylesheet; the stylesheet is copied', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kantahe-legacy-css-'));
  try {
    const input = join(dir, 'in');
    mkdirSync(input);
    writeFileSync(join(input, 'main-A.js'), 'export const v = 1;');
    writeFileSync(join(input, 'index.html'), '<!doctype html><html lang="en"><head><base href="/"><title>t</title><script id="min-engine">var MIN_CHROMIUM = 85;</script></head><body><script src="main-A.js" type="module"></script></body></html>');
    await buildLegacy({ input, output: join(dir, 'out') });
    const html = readFileSync(join(dir, 'out', 'index.html'), 'utf8');
    assert.match(html, /<html lang="en" class="legacy">/);
    assert.match(html, /<link rel="stylesheet" href="legacy\.css">/);
    assert.equal(readFileSync(join(dir, 'out', 'legacy.css'), 'utf8'), CSS);
    // it is served under /legacy/ (its files must not mix with the modern ones of the same name), and it can run on Chromium 74
    assert.match(html, /<base href="\/legacy\/">/);
    assert.doesNotMatch(html, /<base href="\/">/);
    assert.match(html, /var MIN_CHROMIUM = 74;/);
    // and the original page is not touched: the modern build never gets either
    assert.doesNotMatch(readFileSync(join(input, 'index.html'), 'utf8'), /legacy/);
    assert.match(readFileSync(join(input, 'index.html'), 'utf8'), /var MIN_CHROMIUM = 85;/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a page without the base element or without the minimum guard is an error: the web build changed and the legacy build must be looked at', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kantahe-legacy-page-'));
  try {
    for (const [name, html] of [
      ['no base', '<html><head><script id="min-engine">var MIN_CHROMIUM = 85;</script></head><body><script src="a.js"></script></body></html>'],
      ['no guard', '<html><head><base href="/"></head><body><script src="a.js"></script></body></html>'],
    ]) {
      const input = join(dir, name.replace(' ', '-'));
      mkdirSync(input);
      writeFileSync(join(input, 'a.js'), 'export const a = 1;');
      writeFileSync(join(input, 'index.html'), html);
      await assert.rejects(() => buildLegacy({ input, output: join(dir, 'out-' + name.replace(' ', '-')) }), /index\.html/, name);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the minimum of the legacy page is the minimum of the Flutter app (app/lib/player/min_webview.dart)', () => {
  const dart = readFileSync(join(WEB, '..', 'app', 'lib', 'player', 'min_webview.dart'), 'utf8');
  assert.equal(String(LEGACY_MIN_CHROMIUM), /const kMinChromium\s*=\s*(\d+)/.exec(dart)?.[1]);
});
