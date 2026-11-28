import type { BrowserContext, Page } from '@playwright/test';
import type { Raw } from './checks';

// The checks that need the page to move (kantahe-du1.14): still screenshots cannot see a page that moves under the finger, nor the on-screen
// keyboard. Three checks, all reported as findings of the audit:
// - layoutShift on load: the browser's own layout-shift entries (not caused by input) from the start of the page until the state's actions;
//   more than LOAD_SHIFT_LIMIT is a finding (a now-playing bar or an install offer inserted above the page, a footer pushed down).
// - layoutShift after an action, for the states marked `stable` (an action there must move nothing, as adding a song with a toast): the boxes of
//   the rows and buttons are compared before and after the action; one that moved more than MOVE_LIMIT px, the page not scrolled, is a finding.
//   Only for those states: other actions open menus and folds, which move what is under them by design.
// - keyboardCover, for the states that name a text field (`keyboard`), on phones: the field is tapped and typed into, and fewer than
//   KEYBOARD_ROWS list rows (KEYBOARD_ROWS_SMALL on a phone on its side or with 200% text; all of them when the list is shorter) fully above
//   the keyboard's top edge is a finding. Menu and tab bar links, popups and toasts are not rows.
//   Chromium has no on-screen keyboard: its top edge is taken at KEYBOARD_PORTRAIT or KEYBOARD_LANDSCAPE of the window height from the bottom.

export const LOAD_SHIFT_LIMIT = 0.02;
export const MOVE_LIMIT = 2;
export const KEYBOARD_ROWS = 3;
/** On a phone on its side, a phone under 600 px high (320x568: its rows take two lines) or with 200% text, the room above the keyboard holds
 *  one or two rows at best: the first result must show. */
export const KEYBOARD_ROWS_SMALL = 1;
export const KEYBOARD_PORTRAIT = 0.4;
export const KEYBOARD_LANDSCAPE = 0.55;

interface ShiftEntry {
  value: number;
  input: boolean;
  sources: string[];
}

declare global {
  interface Window {
    __kantaheShifts?: ShiftEntry[];
  }
}

/** Before the page opens: every layout shift of the page is recorded in window.__kantaheShifts. */
export function recordShifts(context: BrowserContext): Promise<void> {
  return context.addInitScript(() => {
    const name = (n: Node | null | undefined): string => {
      const el = n instanceof Element ? n : n?.parentElement;
      if (!el) return '';
      const parts: string[] = [];
      for (let e: Element | null = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
        const cls = Array.from(e.classList).filter((c) => !/^(ng-|_ng)/.test(c) && !/\d/.test(c))[0];
        parts.unshift(e.tagName.toLowerCase() + (e.id && !/\d/.test(e.id) ? `#${e.id}` : cls ? `.${cls}` : ''));
      }
      return parts.join(' > ');
    };
    window.__kantaheShifts = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] })[]) {
          window.__kantaheShifts!.push({ value: e.value, input: e.hadRecentInput, sources: (e.sources ?? []).map((s) => name(s.node)).filter(Boolean) });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // a browser without layout-shift entries: nothing is recorded
    }
  });
}

/** The layout-shift findings of what the page recorded so far: their sum over the limit, named by the elements that moved most. */
export async function loadShiftFindings(page: Page): Promise<Raw[]> {
  const entries = await page.evaluate(() => window.__kantaheShifts ?? []);
  return shiftFindings(entries);
}

/** Pure: the shifts not caused by input, summed; one finding naming the elements that moved, or none under the limit. */
export function shiftFindings(entries: ShiftEntry[]): Raw[] {
  const own = entries.filter((e) => !e.input);
  const sum = own.reduce((a, e) => a + e.value, 0);
  if (sum <= LOAD_SHIFT_LIMIT) return [];
  const moved = [...new Set(own.sort((a, b) => b.value - a.value).flatMap((e) => e.sources))].slice(0, 3);
  return [{ check: 'layoutShift', selector: moved[0] ?? 'document', text: moved.join(' | '), detail: `the page moved while it loaded: layout shift ${sum.toFixed(3)} (limit ${LOAD_SHIFT_LIMIT})` }];
}

export interface Box {
  key: string;
  top: number;
  left: number;
}

/** The rows and buttons on screen, outside dialogs, menus and toasts, with their place in the window, and the scroll position. */
export function boxes(page: Page): Promise<{ scrollY: number; boxes: Box[] }> {
  return page.evaluate(() => {
    const keyOf = (el: Element): string => {
      const parts: string[] = [];
      for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
        const same = e.parentElement ? Array.from(e.parentElement.children).filter((c) => c.tagName === e!.tagName) : [];
        parts.unshift(`${e.tagName.toLowerCase()}${same.length > 1 ? `:nth-of-type(${same.indexOf(e) + 1})` : ''}`);
      }
      return parts.join(' > ');
    };
    const list = Array.from(document.querySelectorAll('li, tr, button'))
      .filter((el) => !el.closest('[role=dialog], [role=menu], [data-overlay=toast], aside.install'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight);
    return { scrollY, boxes: list.map(({ el, r }) => ({ key: keyOf(el), top: Math.round(r.top), left: Math.round(r.left) })) };
  });
}

/** Pure: the rows and buttons that were on screen before and moved by more than MOVE_LIMIT (only when the page did not scroll). */
export function moves(before: { scrollY: number; boxes: Box[] }, after: { scrollY: number; boxes: Box[] }): Raw[] {
  if (Math.abs(before.scrollY - after.scrollY) > 0.5) return [];
  const now = new Map(after.boxes.map((b) => [b.key, b]));
  const out: Raw[] = [];
  for (const b of before.boxes) {
    const a = now.get(b.key);
    if (!a) continue;
    const dy = a.top - b.top;
    const dx = a.left - b.left;
    if (Math.abs(dy) > MOVE_LIMIT || Math.abs(dx) > MOVE_LIMIT) {
      // the outermost moved element of a group is enough: a row and its buttons move together
      if (out.some((o) => b.key.startsWith(o.selector + ' > '))) continue;
      out.push({ check: 'layoutShift', selector: b.key, text: '', detail: `moved ${dx} px sideways and ${dy} px down after the action of the state` });
    }
  }
  return out;
}

/** On a phone: taps the field, types, and reports when fewer than KEYBOARD_ROWS list rows are fully above the keyboard. */
export async function keyboardFindings(page: Page, field: string, landscape: boolean, largeText = false): Promise<Raw[]> {
  const input = page.locator(field).first();
  await input.click();
  await input.pressSequentially('ti', { delay: 20 });
  await page.waitForTimeout(700); // the search delay, the answer and the scroll
  const short = (page.viewportSize()?.height ?? 1000) < 600;
  return keyboardCover(page, landscape, landscape || largeText || short ? KEYBOARD_ROWS_SMALL : KEYBOARD_ROWS);
}

/** The keyboard part alone, on the page as it is (tested on small pages). */
export async function keyboardCover(page: Page, landscape: boolean, needed = KEYBOARD_ROWS): Promise<Raw[]> {
  const share = landscape ? KEYBOARD_LANDSCAPE : KEYBOARD_PORTRAIT;
  const { visible, total, line } = await page.evaluate((s) => {
    const line = innerHeight * (1 - s);
    // the rows of the page's lists: not the links of a menu or a tab bar, a popup's items or a toast
    const rows = Array.from(document.querySelectorAll('li.row, tbody tr, ul li, ol li'))
      .filter((r) => !r.closest('nav, [role=menu], [role=dialog], [data-overlay=toast]'))
      .map((r) => r.getBoundingClientRect());
    return { visible: rows.filter((r) => r.top >= 0 && r.bottom <= line).length, total: rows.length, line: Math.round(line) };
  }, share);
  // a list shorter than the rows needed must show all of them
  if (total === 0 || visible >= Math.min(needed, total)) return [];
  return [{ check: 'keyboardCover', selector: 'document', text: '', detail: `${visible} of the list's rows above the keyboard (its top edge at ${line} px); at least ${needed} must show` }];
}
