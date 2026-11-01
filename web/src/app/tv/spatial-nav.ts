import { DestroyRef, inject, Injectable } from '@angular/core';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

const DIRECTIONS: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/** A candidate counts when it lies within 60 degrees of the direction: its distance to the side is at most tan(60) times the way ahead. */
const CONE = Math.tan((60 * Math.PI) / 180);
/** What a unit of distance to the side costs, against a unit of the way ahead: going straight is preferred. */
const SIDE_COST = 2;
/** Among candidates that are as far ahead and as near the beam, the one under the middle of the focus wins. */
const CENTRE_PULL = 0.05;

const center = (r: Rect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** The distance between two ranges on a line; 0 when they overlap. */
const gap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => Math.max(0, aStart - bEnd, bStart - aEnd);

/**
 * Which of the candidates the focus goes to from [from] in a direction. A candidate must lie ahead (its centre beyond
 * the centre of [from]) and within a cone of 60 degrees; its distance to the side is the gap between the two boxes on
 * that axis, 0 when they overlap, so that a wide field is reached from a narrow button above it and the narrow ones
 * under a wide field are reached from it. The score is the way ahead, plus extra for the distance to the side, plus a
 * little for how far the centres are apart sideways. undefined: nothing lies that way.
 */
export function pickNext(from: Rect, candidates: Rect[], dir: Direction): number | undefined {
  const horizontal = dir === 'left' || dir === 'right';
  const f = center(from);
  let best: number | undefined;
  let bestScore = Infinity;
  candidates.forEach((r, i) => {
    const c = center(r);
    const dx = c.x - f.x;
    const dy = c.y - f.y;
    const ahead = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const centres = Math.abs(horizontal ? dy : dx);
    const side = horizontal
      ? gap(from.top, from.top + from.height, r.top, r.top + r.height)
      : gap(from.left, from.left + from.width, r.left, r.left + r.width);
    if (ahead <= 0 || side > ahead * CONE) return;
    const score = ahead + SIDE_COST * side + CENTRE_PULL * centres;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';
/** Controls the browser activates with Enter itself. */
const NATIVE_ENTER = 'a[href], button, input, select, textarea, summary';
const TEXT_INPUT = /^(text|search|url|tel|email|password)$/;

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function usable(el: HTMLElement): boolean {
  if (el.tabIndex < 0 || (el as HTMLButtonElement).disabled || el.closest('[hidden], [inert]')) return false;
  const r = rectOf(el);
  return r.width > 0 && r.height > 0;
}

/** A text field keeps the arrow keys that move its caret, until the caret is at the end they point to. */
function fieldKeepsKey(el: HTMLElement, dir: Direction): boolean {
  const multiline = el instanceof HTMLTextAreaElement;
  const single = el instanceof HTMLInputElement && TEXT_INPUT.test(el.type);
  if (!multiline && !single) return false;
  if (single && (dir === 'up' || dir === 'down')) return false;
  const field = el as HTMLInputElement | HTMLTextAreaElement;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  if (start === null || end === null) return false;
  const toStart = dir === 'left' || dir === 'up';
  return toStart ? !(start === 0 && end === 0) : !(start === field.value.length && end === field.value.length);
}

function focusElement(el: HTMLElement): void {
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/**
 * Remote-control navigation for TV builds: the arrow keys move the focus to the nearest focusable element in that
 * direction and Enter activates what is not a control. A container with data-nav-group is searched first, so a
 * list is walked before the focus leaves it.
 */
@Injectable({ providedIn: 'root' })
export class SpatialNav {
  private doc?: Document;
  private readonly onKey = (e: KeyboardEvent) => this.handle(e);

  constructor() {
    // the listener is on the page's document, which outlives the injector in tests: no stray listener may stay behind
    inject(DestroyRef).onDestroy(() => this.detach());
  }

  attach(doc: Document): void {
    this.detach();
    this.doc = doc;
    doc.addEventListener('keydown', this.onKey);
  }

  detach(): void {
    this.doc?.removeEventListener('keydown', this.onKey);
    this.doc = undefined;
  }

  private handle(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !this.doc) return;
    const dir = DIRECTIONS[e.key];
    if (dir) {
      if (this.move(this.doc, dir)) e.preventDefault();
    } else if (e.key === 'Enter') {
      const active = this.doc.activeElement;
      if (active instanceof HTMLElement && active !== this.doc.body && !active.matches(NATIVE_ENTER)) {
        e.preventDefault();
        active.click();
      }
    }
  }

  /** True when the key was used for moving (also at an edge, so that the page does not scroll). */
  private move(doc: Document, dir: Direction): boolean {
    const all = Array.from(doc.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(usable);
    const active = doc.activeElement;
    if (!(active instanceof HTMLElement) || !all.includes(active)) {
      if (all.length === 0) return false;
      focusElement(all[0]);
      return true;
    }
    if (fieldKeepsKey(active, dir)) return false;
    const others = all.filter((el) => el !== active);
    const from = rectOf(active);
    const group = active.closest('[data-nav-group]');
    // the group is looked at first; when nothing in it lies that way, the whole page is
    const target = (group && this.pick(from, others.filter((el) => group.contains(el)), dir)) || this.pick(from, others, dir);
    if (target) focusElement(target);
    return true;
  }

  private pick(from: Rect, candidates: HTMLElement[], dir: Direction): HTMLElement | undefined {
    const i = pickNext(from, candidates.map(rectOf), dir);
    return i === undefined ? undefined : candidates[i];
  }
}
