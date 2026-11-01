import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// The automatic checks of the responsive audit. pageChecks() runs inside the page (page.evaluate), so it must not use anything
// outside its own body; auditPage() is the Node side: it runs the checks, adds console errors and failed requests, and takes the screenshot.

export type Check =
  | 'horizontalOverflow'
  | 'outsideViewport'
  | 'smallTargets'
  | 'tightTargets'
  | 'clippedText'
  | 'overlap'
  | 'consoleErrors'
  | 'failedRequests'
  | 'brokenImages'
  | 'unreachable';

export type Severity = 'blocker' | 'major' | 'minor';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the page found, before it is given an id and a severity. */
export interface Raw {
  check: Check;
  selector: string;
  text: string;
  rect?: Rect;
  detail?: string;
}

export interface Options {
  /** Smallest side of a tap target, in CSS px. */
  minTarget: number;
  /** Smallest space between two tap targets that sit side by side. */
  minGap: number;
  /**
   * The size of the window the page is meant to fit in. A phone browser (and Chromium's emulation of one) makes the layout viewport as wide as
   * a page that is too wide, so window.innerWidth then agrees with the page and would hide the very problem; the window is told from outside.
   */
  width?: number;
  height?: number;
}

export const DEFAULTS: Options = { minTarget: 44, minGap: 8 };

/** The options with the size of the viewport that the page was given. */
export const optionsFor = (page: Page, base: Options = DEFAULTS): Options => ({ ...base, width: page.viewportSize()?.width, height: page.viewportSize()?.height });

/** The checks that need the page's layout. Everything it uses is inside it. */
export function pageChecks(options: Options): Raw[] {
  const out: Raw[] = [];
  const vw = options.width ?? window.innerWidth;
  const vh = options.height ?? window.innerHeight;
  const round = (n: number) => Math.round(n * 10) / 10;
  const rectOf = (r: DOMRect): Rect => ({ x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height) });
  const textOf = (el: Element) => (el.getAttribute('aria-label') || (el.textContent ?? '')).replace(/\s+/g, ' ').trim().slice(0, 60);

  // A path that stays the same from run to run: tags, up to two plain class names, the position among siblings of the same tag.
  // Ids and classes with digits or from the framework (ng-...) change between runs and are left out.
  const plain = (s: string) => /^[a-z][a-z-]*$/i.test(s) && !s.startsWith('ng-');
  const selectorOf = (el: Element): string => {
    const parts: string[] = [];
    for (let node: Element | null = el; node && node !== document.documentElement && parts.length < 6; node = node.parentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id && plain(node.id)) {
        parts.unshift(`${part}#${node.id}`);
        break;
      }
      part += Array.from(node.classList).filter(plain).slice(0, 2).map((c) => '.' + c).join('');
      const same = node.parentElement ? Array.from(node.parentElement.children).filter((c) => c.tagName === node!.tagName) : [];
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      parts.unshift(part);
    }
    return parts.join(' > ');
  };

  // Drawn at all: a size, not hidden, not see-through, and more than the 1 px square of text that is only for screen readers.
  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || (r.width <= 1 && r.height <= 1)) return false;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || Number(s.opacity) === 0) return false;
    }
    return true;
  };

  const NATIVE = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=menuitem]';
  const everyTarget = Array.from(document.querySelectorAll(`${NATIVE}, [tabindex]`)).filter((el) => {
    if (!el.matches(NATIVE) && Number(el.getAttribute('tabindex')) < 0) return false;
    if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return false;
    const r = el.getBoundingClientRect();
    return r.right > 0 && r.left < vw && visible(el); // not one that is parked wholly outside (a skip link)
  });
  // while a modal dialog is open only what is inside it can be tapped: the page behind its backdrop is not a target
  const modal = Array.from(document.querySelectorAll('[role=dialog][aria-modal=true]')).filter(visible).pop();
  const targets = modal ? everyTarget.filter((el) => modal.contains(el)) : everyTarget;

  // (a) the page scrolls sideways; one pixel of rounding is not counted
  const root = document.scrollingElement ?? document.documentElement;
  if (root.scrollWidth > vw + 1) {
    out.push({ check: 'horizontalOverflow', selector: 'document', text: '', detail: `scrollWidth ${root.scrollWidth} is wider than the window (${vw})` });
  }

  // (b) an element sticks out of the window on the left or the right, unless it sits in something that scrolls sideways on purpose,
  // is parked wholly outside (a skip link, a drawer), or is cut off by an ancestor with overflow hidden so that what is painted fits
  // (a title with an ellipsis; text that is cut without one is clippedText's); only the outermost element of a group is listed
  const scrollsSideways = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
    return false;
  };
  // the part of an element that is painted: cut by every ancestor with overflow hidden or clip; one that is fixed or absolute can escape that
  const paintedFits = (el: Element, r: DOMRect) => {
    let left = r.left;
    let right = r.right;
    const position = getComputedStyle(el).position;
    if (position !== 'fixed' && position !== 'absolute') {
      for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o !== 'hidden' && o !== 'clip') continue;
        const box = p.getBoundingClientRect();
        left = Math.max(left, box.left);
        right = Math.min(right, box.right);
      }
    }
    return right <= left || (right <= vw + 1 && left >= -1);
  };
  const listed: Element[] = [];
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    const r = el.getBoundingClientRect();
    if (r.right <= vw + 1 && r.left >= -1) continue;
    if (r.right <= 0 || r.left >= vw || !visible(el) || scrollsSideways(el) || paintedFits(el, r) || listed.some((p) => p.contains(el))) continue;
    listed.push(el);
    out.push({ check: 'outsideViewport', selector: selectorOf(el), text: textOf(el), rect: rectOf(r), detail: `from ${round(r.left)} to ${round(r.right)} in a window ${vw} wide` });
  }

  // (c) a tap target under the minimum on either side; a checkbox counts together with its label; a link in running text is exempt only when marked
  for (const el of targets) {
    if (el.closest('[data-inline-link]')) continue;
    let { left, right, top, bottom } = el.getBoundingClientRect();
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      for (const label of Array.from(el.labels ?? [])) {
        const l = label.getBoundingClientRect();
        left = Math.min(left, l.left);
        right = Math.max(right, l.right);
        top = Math.min(top, l.top);
        bottom = Math.max(bottom, l.bottom);
      }
    }
    if (right - left < options.minTarget - 0.5 || bottom - top < options.minTarget - 0.5) {
      out.push({ check: 'smallTargets', selector: selectorOf(el), text: textOf(el), rect: rectOf(el.getBoundingClientRect()), detail: `${round(right - left)} x ${round(bottom - top)}, the minimum is ${options.minTarget}` });
    }
  }

  // (d) two targets side by side with a gap of less than the minimum; targets that touch are one group, not tight
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i];
      const b = targets[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const gapX = Math.max(ra.left - rb.right, rb.left - ra.right);
      const gapY = Math.max(ra.top - rb.bottom, rb.top - ra.bottom);
      const tight = (gap: number, other: number) => other < 0 && gap >= 0.5 && gap < options.minGap;
      if (tight(gapX, gapY) || tight(gapY, gapX)) {
        out.push({ check: 'tightTargets', selector: `${selectorOf(a)} + ${selectorOf(b)}`, text: `${textOf(a)} | ${textOf(b)}`, rect: rectOf(ra), detail: `${round(Math.max(gapX, gapY))} px apart` });
      }
    }
  }

  // (e) text cut off by overflow:hidden without an ellipsis or a line clamp
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    if (el instanceof SVGElement || el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) continue;
    const s = getComputedStyle(el);
    const clips = (v: string) => v === 'hidden' || v === 'clip';
    if (!clips(s.overflowX) && !clips(s.overflowY)) continue;
    const wide = clips(s.overflowX) && el.scrollWidth > el.clientWidth + 1;
    const tall = clips(s.overflowY) && el.scrollHeight > el.clientHeight + 1;
    if ((!wide && !tall) || !(el.textContent ?? '').trim() || !visible(el)) continue;
    const clamp = s.getPropertyValue('-webkit-line-clamp') || s.getPropertyValue('line-clamp');
    const clamped = clamp !== '' && clamp !== 'none';
    if ((wide && !tall && s.textOverflow === 'ellipsis') || (tall && clamped)) continue; // a clamp cuts lines by design; a few pixels of sideways excess of a centred line are not clipping
    out.push({ check: 'clippedText', selector: selectorOf(el), text: textOf(el), rect: rectOf(el.getBoundingClientRect()), detail: `content ${el.scrollWidth} x ${el.scrollHeight} in a box of ${el.clientWidth} x ${el.clientHeight}` });
  }

  // (f) a fixed or sticky element on top of a target that cannot be scrolled out from under it: at the top of the page for what is
  // anchored in the upper half, at the end of the page for a fixed element in the lower half; dialogs and empty backdrops are meant to cover
  const covering = Array.from(document.body.querySelectorAll('*')).filter((el) => {
    const p = getComputedStyle(el).position;
    if (p !== 'fixed' && p !== 'sticky') return false;
    if (el.closest('[role=dialog], [role=alertdialog], [aria-modal=true]') || !visible(el)) return false;
    return (el.textContent ?? '').trim() !== '' || el.querySelector(NATIVE) !== null;
  });
  if (covering.length > 0) {
    const was = window.scrollY;
    const seen = new Set<string>();
    const scan = (y: number, wanted: (el: Element, r: DOMRect) => boolean) => {
      window.scrollTo({ top: y, behavior: 'instant' });
      for (const o of covering) {
        const ro = o.getBoundingClientRect();
        if (!wanted(o, ro)) continue;
        for (const t of targets) {
          if (o.contains(t) || covering.some((c) => c.contains(t))) continue;
          const rt = t.getBoundingClientRect();
          const w = Math.min(ro.right, rt.right) - Math.max(ro.left, rt.left);
          const h = Math.min(ro.bottom, rt.bottom) - Math.max(ro.top, rt.top);
          const key = `${selectorOf(o)}>${selectorOf(t)}`;
          if (w * h > 4 && !seen.has(key)) {
            seen.add(key);
            out.push({ check: 'overlap', selector: selectorOf(t), text: textOf(t), rect: rectOf(rt), detail: `under ${selectorOf(o)}` });
          }
        }
      }
    };
    scan(0, (_, r) => r.top < vh / 2);
    scan(Number.MAX_SAFE_INTEGER, (el, r) => getComputedStyle(el).position === 'fixed' && r.bottom > vh / 2);
    window.scrollTo({ top: was, behavior: 'instant' });
  }

  // (h) an image that was loaded and has no picture
  for (const img of Array.from(document.images)) {
    if (img.complete && img.naturalWidth === 0 && img.currentSrc !== '') {
      out.push({ check: 'brokenImages', selector: selectorOf(img), text: img.currentSrc.slice(0, 80), rect: rectOf(img.getBoundingClientRect()) });
    }
  }
  return out;
}

export interface StateMeta {
  /** The route as written in app.routes.ts, e.g. "/me/playlists/:id". */
  route: string;
  /** The situation on that route: "empty", "many", "dialog"... */
  state: string;
  viewport: string;
  theme: string;
  /** A core flow: sideways scrolling there is a blocker. */
  core?: boolean;
}

export interface Finding {
  /** Stable from run to run for the same build: route and state, viewport, theme, check, selector. */
  id: string;
  route: string;
  state: string;
  viewport: string;
  theme: string;
  check: Check;
  severity: Severity;
  selector: string;
  /** The selector without the positions among siblings, so that the rows of a list group together. */
  pattern: string;
  text: string;
  rect?: Rect;
  detail?: string;
  /** Path of the screenshot, relative to the report folder. */
  screenshot: string;
}

/** How many findings of one check are kept for one state; the rest are only counted. */
export const MAX_PER_CHECK = 25;

export function severityOf(check: Check, core: boolean | undefined): Severity {
  switch (check) {
    case 'unreachable':
      return 'blocker';
    case 'horizontalOverflow':
    case 'outsideViewport':
      return core ? 'blocker' : 'major';
    case 'smallTargets':
    case 'tightTargets':
    case 'clippedText':
    case 'overlap':
      return 'major';
    default:
      return 'minor';
  }
}

export const stateId = (m: Pick<StateMeta, 'route' | 'state' | 'viewport' | 'theme'>) => `${m.route}:${m.state}|${m.viewport}|${m.theme}`;
export const fileName = (m: Pick<StateMeta, 'route' | 'state' | 'viewport' | 'theme'>) => stateId(m).replace(/[^A-Za-z0-9.-]+/g, '_') + '.png';

export const patternOf = (selector: string) => selector.replace(/:nth-of-type\(\d+\)/g, '');

/** What the browser reported while the page was open: errors in the console and requests that failed. */
export interface Watch {
  errors: string[];
  failed: string[];
}

/** Starts listening; `ignore` drops messages that a state causes on purpose (an RPC that is made to fail). */
export function watch(page: Page, ignore: RegExp[] = []): Watch {
  const w: Watch = { errors: [], failed: [] };
  const keep = (s: string) => !ignore.some((re) => re.test(s));
  page.on('console', (m) => m.type() === 'error' && keep(m.text()) && w.errors.push(m.text()));
  page.on('pageerror', (e) => keep(String(e)) && w.errors.push(String(e)));
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText ?? '';
    if (!why.includes('ERR_ABORTED') && keep(r.url())) w.failed.push(`${r.method()} ${new URL(r.url()).pathname}: ${why}`);
  });
  page.on('response', (r) => r.status() >= 400 && keep(r.url()) && w.failed.push(`${r.request().method()} ${new URL(r.url()).pathname}: ${r.status()}`));
  return w;
}

const normal = (s: string) => s.replace(/https?:\/\/\S+/g, 'URL').replace(/\d+/g, '#').slice(0, 100);

/**
 * Runs the checks on the page as it is now, takes a full-page screenshot into `<outDir>/shots` and returns the findings.
 * Findings of one check beyond MAX_PER_CHECK are counted in `omitted`, not listed.
 */
export async function auditPage(
  page: Page,
  meta: StateMeta,
  outDir: string,
  seen: Watch = { errors: [], failed: [] },
  options: Options = optionsFor(page),
  extra: Raw[] = [],
): Promise<{ findings: Finding[]; omitted: number; screenshot: string }> {
  await page.evaluate(() => document.fonts.ready);
  const raw: Raw[] = [...extra, ...(await page.evaluate(pageChecks, options))];
  seen.errors.forEach((text) => raw.push({ check: 'consoleErrors', selector: normal(text), text }));
  seen.failed.forEach((text) => raw.push({ check: 'failedRequests', selector: normal(text), text }));

  mkdirSync(join(outDir, 'shots'), { recursive: true });
  const screenshot = `shots/${fileName(meta)}`;
  await page.screenshot({ path: join(outDir, screenshot), fullPage: true, scale: 'css', animations: 'disabled', caret: 'hide' });

  const base = stateId(meta);
  const kept = new Map<Check, number>();
  const ids = new Map<string, number>();
  let omitted = 0;
  const findings: Finding[] = [];
  for (const r of raw) {
    const n = (kept.get(r.check) ?? 0) + 1;
    kept.set(r.check, n);
    if (n > MAX_PER_CHECK) {
      omitted++;
      continue;
    }
    const plainId = `${base}|${r.check}|${r.selector}`;
    const again = (ids.get(plainId) ?? 0) + 1;
    ids.set(plainId, again);
    findings.push({
      id: again === 1 ? plainId : `${plainId}#${again}`,
      route: meta.route,
      state: meta.state,
      viewport: meta.viewport,
      theme: meta.theme,
      check: r.check,
      severity: severityOf(r.check, meta.core),
      selector: r.selector,
      pattern: patternOf(r.selector),
      text: r.text,
      rect: r.rect,
      detail: r.detail,
      screenshot,
    });
  }
  return { findings, omitted, screenshot };
}
