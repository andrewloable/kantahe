import { expect, Page, test } from '@playwright/test';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditPage, Check, fileName, MAX_PER_CHECK, optionsFor, pageChecks, Raw, severityOf, stateId, watch } from './checks';
import { pick, THEMES, VIEWPORTS } from './matrix';
import { auditOutDir } from './out';
import { buildReport, hasBlocker, loadBaseline, Outcome, toHtml, toMarkdown, verdict } from './report';

// The checks of the audit tested on small pages. Each test is a page that must be reported and a page that must not: a check that
// cannot fail proves nothing.

test.use({ viewport: { width: 400, height: 700 } });

const BASE = '<style>body { margin: 0; } button { padding: 0; border: 0; }</style>';

async function run(page: Page, html: string): Promise<Raw[]> {
  await page.setContent(BASE + html);
  return page.evaluate(pageChecks, optionsFor(page));
}
const of = (raw: Raw[], check: Check) => raw.filter((r) => r.check === check);

const button = (w: number, h: number, left = 0, top = 0, text = 'OK') =>
  `<button style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px">${text}</button>`;

test.describe('horizontalOverflow', () => {
  test('a page wider than the window is reported', async ({ page }) => {
    expect(of(await run(page, '<div style="width:600px;height:10px">wide</div>'), 'horizontalOverflow')).toHaveLength(1);
  });
  test('one pixel of rounding is tolerated, two are not', async ({ page }) => {
    expect(of(await run(page, '<div style="width:401px;height:10px"></div>'), 'horizontalOverflow')).toHaveLength(0);
    expect(of(await run(page, '<div style="width:402px;height:10px"></div>'), 'horizontalOverflow')).toHaveLength(1);
  });
});

test.describe('a phone browser', () => {
  // Chromium's phone emulation, like a phone, makes the layout viewport as wide as a page that is too wide: innerWidth is then the width of
  // the page and says nothing. The audit tells the checks the size of the window from outside.
  test.use({ isMobile: true, hasTouch: true });
  const wide = '<meta name="viewport" content="width=device-width, initial-scale=1"><div style="width:600px;height:10px">wide</div><button style="position:absolute;left:500px;top:50px;width:60px;height:60px">Edit</button>';

  test('a page that is too wide is reported although the browser widens its window to fit it', async ({ page }) => {
    const raw = await run(page, wide);
    expect(of(raw, 'horizontalOverflow')).toHaveLength(1);
    expect(of(raw, 'outsideViewport').length).toBeGreaterThan(0);
  });
  test('a page that fits is clean', async ({ page }) => {
    expect(await run(page, '<meta name="viewport" content="width=device-width, initial-scale=1"><div style="width:300px;height:10px">fits</div>')).toEqual([]);
  });
});

test.describe('outsideViewport', () => {
  const inParent = (parentStyle: string) =>
    `<div style="margin-left:350px;width:50px;${parentStyle}"><div style="width:100px;height:20px">a child of 100 px</div></div>`;

  test('a 100 px child of a 50 px parent that reaches beyond the window is reported', async ({ page }) => {
    const found = of(await run(page, inParent('')), 'outsideViewport');
    expect(found).toHaveLength(1);
    expect(found[0].text).toContain('a child of 100 px');
  });
  test('the same child inside overflow-x:auto is not reported', async ({ page }) => {
    expect(of(await run(page, inParent('overflow-x:auto')), 'outsideViewport')).toHaveLength(0);
  });
  test('one pixel beyond the window is tolerated, two are not', async ({ page }) => {
    expect(of(await run(page, '<div style="margin-left:300px;width:101px;height:10px">a</div>'), 'outsideViewport')).toHaveLength(0);
    expect(of(await run(page, '<div style="margin-left:300px;width:102px;height:10px">a</div>'), 'outsideViewport')).toHaveLength(1);
  });
  test('an element parked wholly outside (a skip link) is not reported', async ({ page }) => {
    const raw = await run(page, '<a href="#main" style="position:absolute;left:-999px;top:0">Skip to content</a>');
    expect(of(raw, 'outsideViewport')).toHaveLength(0);
    expect(of(raw, 'smallTargets')).toHaveLength(0);
  });
  test('text that an ancestor with overflow hidden cuts off with an ellipsis is not outside the window', async ({ page }) => {
    const raw = await run(page, '<div style="width:200px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"><strong style="display:inline-block;width:700px">a very long title</strong></div>');
    expect(of(raw, 'outsideViewport')).toHaveLength(0);
    expect(of(raw, 'clippedText')).toHaveLength(0);
  });
  test('a block with overflow hidden that itself reaches beyond the window is reported once', async ({ page }) => {
    expect(of(await run(page, '<div style="margin-left:350px;width:100px;overflow:hidden"><p>text inside</p></div>'), 'outsideViewport')).toHaveLength(1);
  });
  test('an absolutely positioned child can escape the clipping and is still reported', async ({ page }) => {
    const raw = await run(page, '<div style="width:200px;overflow:hidden"><span style="position:absolute;left:350px;width:100px;height:20px">out</span></div>');
    expect(of(raw, 'outsideViewport')).toHaveLength(1);
  });
  test('an ellipsis box inside an overflow hidden box inside a sideways scroller is not outside the window', async ({ page }) => {
    const raw = await run(page, '<div style="margin-left:350px;width:50px;overflow-x:auto"><div style="width:30px;overflow:hidden"><span style="display:inline-block;width:100px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">long text here</span></div></div>');
    expect(of(raw, 'outsideViewport')).toHaveLength(0);
  });
  test('only the outermost element of a group that sticks out is listed', async ({ page }) => {
    expect(of(await run(page, '<div style="margin-left:350px;width:100px"><p><span>inner</span></p></div>'), 'outsideViewport')).toHaveLength(1);
  });
});

test.describe('smallTargets', () => {
  test('a 30x30 button is reported, a 44x44 button is clean', async ({ page }) => {
    expect(of(await run(page, button(30, 30)), 'smallTargets')).toHaveLength(1);
    expect(of(await run(page, button(44, 44)), 'smallTargets')).toHaveLength(0);
  });
  test('a button of 42 px is still too small (40 px is not enough)', async ({ page }) => {
    expect(of(await run(page, button(42, 42)), 'smallTargets')).toHaveLength(1);
  });
  test('either side counts: 100 wide and 20 high is reported', async ({ page }) => {
    expect(of(await run(page, button(100, 20)), 'smallTargets')).toHaveLength(1);
  });
  test('a link in running text is exempt only when it is marked', async ({ page }) => {
    const link = (attrs: string) => `<p style="font-size:16px">Read <a href="#x" ${attrs}>the terms</a> first.</p>`;
    expect(of(await run(page, link('')), 'smallTargets')).toHaveLength(1);
    expect(of(await run(page, link('data-inline-link')), 'smallTargets')).toHaveLength(0);
  });
  test('a checkbox counts together with its label', async ({ page }) => {
    const box = (label: string) => `<label style="display:block;height:48px;width:200px"><input type="checkbox">${label}</label>`;
    expect(of(await run(page, box('Remember me')), 'smallTargets')).toHaveLength(0);
    expect(of(await run(page, '<input type="checkbox" aria-label="Admin">'), 'smallTargets')).toHaveLength(1);
  });
  test('a disabled button and a hidden one are not targets', async ({ page }) => {
    const raw = await run(page, '<button disabled style="width:20px;height:20px">x</button><button hidden style="width:20px;height:20px">y</button>');
    expect(of(raw, 'smallTargets')).toHaveLength(0);
  });
});

test.describe('tightTargets', () => {
  const two = (gap: number) => button(44, 44, 0, 0, 'A') + button(44, 44, 44 + gap, 0, 'B');
  test('two 44 px buttons 2 px apart are reported', async ({ page }) => {
    expect(of(await run(page, two(2)), 'tightTargets')).toHaveLength(1);
  });
  test('two 44 px buttons 8 px apart are clean', async ({ page }) => {
    expect(of(await run(page, two(8)), 'tightTargets')).toHaveLength(0);
  });
  test('7 px apart is reported, buttons that touch are one group and clean', async ({ page }) => {
    expect(of(await run(page, two(7)), 'tightTargets')).toHaveLength(1);
    expect(of(await run(page, two(0)), 'tightTargets')).toHaveLength(0);
  });
  test('one above the other counts too', async ({ page }) => {
    expect(of(await run(page, button(44, 44, 0, 0, 'A') + button(44, 44, 0, 48, 'B')), 'tightTargets')).toHaveLength(1);
  });
  test('a target inside another is not tight with it', async ({ page }) => {
    expect(of(await run(page, '<a href="#x" style="display:block;width:200px;height:60px"><button style="width:44px;height:44px">i</button></a>'), 'tightTargets')).toHaveLength(0);
  });
});

test.describe('controls behind a modal dialog', () => {
  const page2 = (dialog: boolean) =>
    button(44, 44, 0, 0, 'A') + button(44, 44, 46, 0, 'B') +
    (dialog
      ? '<div style="position:fixed;inset:0;background:#0006"></div><div role="dialog" aria-modal="true" style="position:fixed;left:100px;top:200px;width:250px;background:#fff"><input style="height:44px;width:200px"><button style="width:30px;height:30px">x</button></div>'
      : '');
  test('two buttons 2 px apart are reported without a dialog', async ({ page }) => {
    expect(of(await run(page, page2(false)), 'tightTargets')).toHaveLength(1);
  });
  test('the same buttons behind the backdrop of a modal dialog are not targets', async ({ page }) => {
    expect(of(await run(page, page2(true)), 'tightTargets')).toHaveLength(0);
  });
  test('a dialog that is not modal does not hide the controls of the page', async ({ page }) => {
    const html = page2(true).replace('aria-modal="true"', '');
    expect(of(await run(page, html), 'tightTargets')).toHaveLength(1);
  });
  test('a small button inside the modal dialog is still reported', async ({ page }) => {
    expect(of(await run(page, page2(true)), 'smallTargets')).toHaveLength(1);
  });
});

test.describe('clippedText', () => {
  const box = (style: string) => `<div style="width:50px;height:20px;overflow:hidden;${style}">${'wide '.repeat(40)}</div>`;
  test('a 50 px box with overflow hidden that holds 200 px of text is reported', async ({ page }) => {
    expect(of(await run(page, box('white-space:nowrap')), 'clippedText')).toHaveLength(1);
  });
  test('a box without a clamp whose text runs 3 px beyond it is still reported', async ({ page }) => {
    expect(of(await run(page, '<div style="width:100px;overflow:hidden;white-space:nowrap">' + 'x'.repeat(15) + '</div>'), 'clippedText')).toHaveLength(1);
  });
  test('with an ellipsis it is clean', async ({ page }) => {
    expect(of(await run(page, box('white-space:nowrap;text-overflow:ellipsis')), 'clippedText')).toHaveLength(0);
  });
  test('text cut off at the bottom is reported, a line clamp is clean', async ({ page }) => {
    expect(of(await run(page, box('')), 'clippedText')).toHaveLength(1);
    expect(of(await run(page, box('display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1')), 'clippedText')).toHaveLength(0);
  });
  test('a line clamp over a long centred title is clean even when the browser reports a few pixels of sideways overflow', async ({ page }) => {
    const title = 'Longtitle both of a most wonderful song with a name that goes on and on and on and on and on and on and on';
    const raw = await run(page, `<div style="width:520px;text-align:center"><h1 style="margin:0;font-size:24px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere">${title}</h1></div>`);
    expect(of(raw, 'clippedText')).toHaveLength(0);
  });
  test('text for screen readers only (1 px, hidden) is clean', async ({ page }) => {
    expect(of(await run(page, '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">for screen readers</span>'), 'clippedText')).toHaveLength(0);
  });
});

test.describe('overlap', () => {
  const footer = (attrs = '') => `<div ${attrs} style="position:fixed;left:0;right:0;bottom:0;height:100px;background:#ccc">footer</div>`;
  test('a fixed footer on top of a button is reported', async ({ page }) => {
    const found = of(await run(page, button(100, 50, 10, 600, 'Pay') + footer()), 'overlap');
    expect(found).toHaveLength(1);
    expect(found[0].text).toBe('Pay');
  });
  test('a fixed footer that covers nothing is clean', async ({ page }) => {
    expect(of(await run(page, button(100, 50, 10, 100, 'Pay') + footer()), 'overlap')).toHaveLength(0);
  });
  test('a dialog is meant to cover the page', async ({ page }) => {
    expect(of(await run(page, button(100, 50, 10, 600, 'Pay') + footer('role="dialog"')), 'overlap')).toHaveLength(0);
  });
  test('a button inside the fixed footer is not covered by it', async ({ page }) => {
    expect(of(await run(page, '<div style="position:fixed;left:0;right:0;bottom:0;height:100px"><button style="width:60px;height:50px">Go</button></div>'), 'overlap')).toHaveLength(0);
  });
  test('the page is scrolled back to where it was', async ({ page }) => {
    await run(page, '<div style="height:3000px"></div>' + footer());
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.evaluate(pageChecks, optionsFor(page));
    expect(await page.evaluate(() => window.scrollY)).toBe(500);
  });
});

test.describe('browser messages and images', () => {
  test('an error in the console and a failed request are reported', async ({ page }) => {
    const seen = watch(page);
    await page.route('http://example.test/**', (r) => r.fulfill({ status: 404, body: 'no' }));
    await page.setContent(BASE + '<script>console.error("boom 42"); fetch("http://example.test/missing");</script>');
    await expect.poll(() => seen.failed.length).toBeGreaterThan(0);
    const dir = mkdtempSync(join(tmpdir(), 'kantahe-checks-'));
    try {
      const { findings } = await auditPage(page, { route: '/x', state: 's', viewport: 'v', theme: 'light' }, dir, seen);
      expect(findings.filter((f) => f.check === 'consoleErrors').map((f) => f.text)).toContain('boom 42');
      expect(findings.filter((f) => f.check === 'failedRequests').map((f) => f.text)).toContain('GET /missing: 404');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test('what a state causes on purpose can be ignored', async ({ page }) => {
    const seen = watch(page, [/boom/]);
    await page.setContent(BASE + '<script>console.error("boom 42");</script>');
    expect(seen.errors).toEqual([]);
  });
  test('an image that did not load is reported', async ({ page }) => {
    expect(of(await run(page, '<img src="data:image/png;base64,AAAA" width="20" height="20" alt="">'), 'brokenImages')).toHaveLength(1);
  });
});

test.describe('a clean page', () => {
  test('a responsive page has no findings at all', async ({ page }) => {
    const raw = await run(
      page,
      `<main style="padding:16px"><h1>Songs</h1><p>Some text that wraps nicely inside the window and does not need more than it has.</p>
       <button style="min-width:96px;min-height:48px;margin:0 0 16px">Add</button><br>
       <button style="min-width:96px;min-height:48px">Remove</button>
       <div style="overflow-x:auto"><table style="width:900px"><tr><td>a wide table that scrolls on purpose</td></tr></table></div></main>`,
    );
    expect(raw).toEqual([]);
  });
});

test.describe('ids, files and the report', () => {
  const meta = { route: '/library', state: 'many', viewport: 'phone-390x844', theme: 'light', core: true };

  test('the ids are the same on two runs of the same page, and so is the count', async ({ page }) => {
    const html = button(30, 30, 0, 0, 'A') + button(30, 30, 40, 0, 'B') + '<div style="width:600px;height:10px"></div>';
    await page.setContent(BASE + html);
    const dir = mkdtempSync(join(tmpdir(), 'kantahe-checks-'));
    try {
      const first = await auditPage(page, meta, dir);
      const second = await auditPage(page, meta, dir);
      expect(second.findings.map((f) => f.id)).toEqual(first.findings.map((f) => f.id));
      expect(first.findings.length).toBeGreaterThan(2);
      const outcome = (o: typeof first): Outcome => ({ state: { id: stateId(meta), ...meta, screenshot: o.screenshot, omitted: o.omitted }, findings: o.findings });
      const a = buildReport([outcome(first)], 1, undefined, 'x');
      const b = buildReport([outcome(second)], 1, undefined, 'x');
      expect(b.counts).toEqual(a.counts);
      expect(b.findings.map((f) => f.id)).toEqual(a.findings.map((f) => f.id));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the screenshot is written under the name of the state, and the finding points to it', async ({ page }) => {
    await page.setContent(BASE + button(30, 30));
    const dir = mkdtempSync(join(tmpdir(), 'kantahe-checks-'));
    try {
      const { findings, screenshot } = await auditPage(page, meta, dir);
      expect(screenshot).toBe(`shots/${fileName(meta)}`);
      expect(fileName(meta)).toBe('_library_many_phone-390x844_light.png');
      expect(existsSync(join(dir, screenshot))).toBe(true);
      expect(statSync(join(dir, screenshot)).size).toBeGreaterThan(100);
      expect(findings.every((f) => f.screenshot === screenshot)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('two findings with the same path get different ids; a check keeps at most MAX_PER_CHECK and counts the rest', async ({ page }) => {
    const many = Array.from({ length: MAX_PER_CHECK + 5 }, (_, i) => button(30, 30, 0, i * 40, 'x')).join('');
    await page.setContent(BASE + many);
    const dir = mkdtempSync(join(tmpdir(), 'kantahe-checks-'));
    try {
      const { findings, omitted } = await auditPage(page, meta, dir, undefined, undefined, [
        { check: 'consoleErrors', selector: 'same', text: 'one' },
        { check: 'consoleErrors', selector: 'same', text: 'two' },
      ]);
      const ids = findings.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.some((id) => id.endsWith('|consoleErrors|same#2'))).toBe(true);
      expect(findings.filter((f) => f.check === 'smallTargets')).toHaveLength(MAX_PER_CHECK);
      expect(omitted).toBeGreaterThanOrEqual(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('sideways scrolling is a blocker on a core flow and a major finding elsewhere; the rest follows the plan', () => {
    expect(severityOf('horizontalOverflow', true)).toBe('blocker');
    expect(severityOf('outsideViewport', true)).toBe('blocker');
    expect(severityOf('horizontalOverflow', false)).toBe('major');
    for (const c of ['smallTargets', 'tightTargets', 'clippedText', 'overlap'] as Check[]) expect(severityOf(c, true)).toBe('major');
    for (const c of ['consoleErrors', 'failedRequests', 'brokenImages'] as Check[]) expect(severityOf(c, true)).toBe('minor');
    expect(severityOf('unreachable', false)).toBe('blocker');
  });

  test('a blocker fails the run and shows in report.md with the link to its screenshot; the baseline marks what is new', async ({ page }) => {
    await page.setContent(BASE + '<table style="width:500px"><tr><td>wide</td></tr></table>');
    const dir = mkdtempSync(join(tmpdir(), 'kantahe-checks-'));
    try {
      const { findings, screenshot, omitted } = await auditPage(page, { ...meta, route: '/selftest', state: 'wide-table' }, dir);
      const outcome: Outcome = { state: { id: 'x', route: '/selftest', state: 'wide-table', viewport: meta.viewport, theme: meta.theme, screenshot, omitted }, findings };
      const report = buildReport([outcome], 1000, undefined, '2026-01-01');
      expect(report.counts.blocker).toBeGreaterThan(0);
      expect(hasBlocker(report)).toBe(true);
      const md = toMarkdown(report);
      expect(md).toContain('## blocker: horizontalOverflow');
      expect(md).toContain(`](${screenshot})`);
      expect(md).toContain('not Safari');
      expect(toHtml(report)).toContain(screenshot);

      const baseline = new Set(findings.slice(0, 1).map((f) => f.id));
      const next = buildReport([outcome], 1000, baseline, '2026-01-01');
      expect(next.newCounts!.blocker + next.newCounts!.major + next.newCounts!.minor).toBe(findings.length - 1);
      expect(toMarkdown(next)).toContain('New since the baseline');
      expect(hasBlocker(buildReport([{ ...outcome, findings: [] }], 1000))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

test.describe('the verdict of a run', () => {
  const report = (blockers: number) => {
    const finding = { id: 'x', route: '/a', state: 's', viewport: 'v', theme: 'light', check: 'horizontalOverflow' as Check, severity: 'blocker' as const, selector: 'document', pattern: 'document', text: '', screenshot: 's.png' };
    return buildReport([{ state: { id: 'x', route: '/a', state: 's', viewport: 'v', theme: 'light', screenshot: 's.png', omitted: 0 }, findings: Array(blockers).fill(finding) }], 1);
  };
  test('a blocker fails the run', () => {
    expect(verdict(report(1), [], false)).toBe('failed');
  });
  test('--allow-findings records a baseline: blockers do not fail the run', () => {
    expect(verdict(report(1), [], true)).toBe('passed');
  });
  test('no blocker passes', () => {
    expect(verdict(report(0), [], false)).toBe('passed');
  });
  test('a test of the audit that broke fails the run, whatever the findings and the flag', () => {
    expect(verdict(report(0), ['/library many: the browser closed'], true)).toBe('failed');
  });
});

test.describe('the baseline', () => {
  const file = (text: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'kantahe-checks-'));
    const path = join(dir, 'report.json');
    writeFileSync(path, text);
    return { dir, path };
  };
  test('the ids of an earlier report.json are read', () => {
    const f = file(JSON.stringify({ findings: [{ id: 'a' }, { id: 'b' }] }));
    try {
      expect([...loadBaseline(f.path)]).toEqual(['a', 'b']);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });
  test('a file that is not a report is refused with a clear message', () => {
    const f = file('{"hello": 1}');
    try {
      expect(() => loadBaseline(f.path)).toThrow(/not a report.json/);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });
  test('a baseline that is missing is refused when the configuration is loaded, not after a run of minutes', () => {
    const was = process.env['KANTAHE_AUDIT_BASELINE'];
    process.env['KANTAHE_AUDIT_BASELINE'] = join(tmpdir(), 'kantahe-no-such-folder', 'report.json');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- the configuration is loaded the way Playwright loads it, as it stands
      expect(() => require('./audit.config')).toThrow(/baseline/i);
    } finally {
      if (was === undefined) delete process.env['KANTAHE_AUDIT_BASELINE'];
      else process.env['KANTAHE_AUDIT_BASELINE'] = was;
    }
  });
});

test.describe('the matrix and the output folder', () => {
  test('the matrix has every viewport of the plan, two themes and the zoom variants', () => {
    const names = VIEWPORTS.map((v) => v.name);
    for (const n of ['phone-320x568', 'phone-430x932', 'phone-landscape-915x412', 'tablet-1024x1366', 'tablet-landscape-1366x1024', 'desktop-1920x1080']) expect(names).toContain(n);
    expect(VIEWPORTS.filter((v) => v.zoom).map((v) => v.name)).toEqual(['phone-390x844-zoom200', 'tablet-768x1024-zoom200']);
    expect(VIEWPORTS.filter((v) => !v.zoom)).toHaveLength(25);
    expect(THEMES).toEqual(['light', 'dark']);
  });
  test('a whole name picks one viewport, a part of a name picks every match, a wrong word is an error', () => {
    expect(pick(VIEWPORTS, 'phone-390x844').map((v) => v.name)).toEqual(['phone-390x844']);
    expect(pick(VIEWPORTS, '390x844').map((v) => v.name)).toEqual(['phone-390x844', 'phone-390x844-zoom200']);
    expect(pick(VIEWPORTS, undefined)).toHaveLength(VIEWPORTS.length);
    expect(() => pick(VIEWPORTS, 'nokia')).toThrow(/Nothing matches/);
  });
  test('the report is never written inside the repository', () => {
    const was = process.env['KANTAHE_AUDIT_OUT'];
    try {
      process.env['KANTAHE_AUDIT_OUT'] = join(__dirname, 'somewhere');
      expect(() => auditOutDir()).toThrow(/inside the repository/);
      process.env['KANTAHE_AUDIT_OUT'] = join(tmpdir(), 'kantahe-elsewhere');
      expect(auditOutDir()).toBe(join(tmpdir(), 'kantahe-elsewhere'));
    } finally {
      if (was === undefined) delete process.env['KANTAHE_AUDIT_OUT'];
      else process.env['KANTAHE_AUDIT_OUT'] = was;
    }
  });
});
