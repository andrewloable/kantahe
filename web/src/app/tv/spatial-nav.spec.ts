import { TestBed } from '@angular/core/testing';
import { pickNext, Rect, SpatialNav } from './spatial-nav';

const rect = (x: number, y: number, w = 100, h = 50): Rect => ({ left: x, top: y, width: w, height: h });

describe('pickNext', () => {
  // a 3 x 3 grid of buttons, indices 0..8 row by row
  const grid = Array.from({ length: 9 }, (_, i) => rect((i % 3) * 120, Math.floor(i / 3) * 70));

  it('moves to the neighbour in that direction from the centre', () => {
    const others = grid.filter((_, i) => i !== 4);
    const idx = (dir: 'up' | 'down' | 'left' | 'right') => {
      const j = pickNext(grid[4], others, dir);
      return j === undefined ? undefined : grid.indexOf(others[j]);
    };
    expect(idx('right')).toBe(5);
    expect(idx('left')).toBe(3);
    expect(idx('up')).toBe(1);
    expect(idx('down')).toBe(7);
  });

  it('stays where it is at the edge: nothing above the top row', () => {
    const others = grid.filter((_, i) => i !== 1);
    expect(pickNext(grid[1], others, 'up')).toBeUndefined();
  });

  it('prefers the one straight ahead to a nearer diagonal one', () => {
    const from = rect(0, 300);
    const straight = rect(0, 0); // 300 px up
    const diagonal = rect(250, 180); // 120 px up, but well off to the side
    expect(pickNext(from, [diagonal, straight], 'up')).toBe(1);
  });

  it('regression: a wide element is reached from a narrow one above it, and from it the narrow ones below it', () => {
    // the library page: a tab at the left, the search field across the page, the format chips under its left end
    const tab = rect(136, 230, 140, 60);
    const input = rect(136, 357, 1008, 65);
    const chip = rect(135, 447, 90, 65);
    expect(pickNext(tab, [input, chip], 'down')).toBe(0); // the field, not the chip beyond it
    expect(pickNext(input, [chip], 'down')).toBe(0); // from the field, the chips under it
    expect(pickNext(chip, [input], 'up')).toBe(0); // and back up to the field
  });

  it('with several under a wide element, the one nearest to where the focus was', () => {
    const input = rect(0, 0, 900, 50);
    const chips = [rect(0, 100, 100), rect(400, 100, 100), rect(800, 100, 100)];
    expect(pickNext(input, chips, 'down')).toBe(1); // the middle chip is nearest to the middle of the field
  });

  it('an element on top of the focused one (nested focusables share a centre) is not a way to go', () => {
    expect(pickNext(rect(0, 0), [rect(0, 0), rect(10, 5, 80, 40)], 'down')).toBeUndefined();
  });

  it('ignores what lies outside the cone of the direction', () => {
    const from = rect(0, 200);
    const wide = rect(400, 150); // up by 50, right by 400: far outside 60 degrees
    expect(pickNext(from, [wide], 'up')).toBeUndefined();
    expect(pickNext(from, [wide], 'right')).toBe(0);
  });

  it('takes the nearest of two in the same direction', () => {
    const from = rect(0, 300);
    expect(pickNext(from, [rect(0, 0), rect(0, 150)], 'up')).toBe(1);
  });
});

function stub(el: HTMLElement, r: Rect | 'hidden'): HTMLElement {
  const box = r === 'hidden' ? { left: 0, top: 0, width: 0, height: 0 } : r;
  el.getBoundingClientRect = () => ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({}) });
  return el;
}

function button(parent: HTMLElement, label: string, r: Rect | 'hidden'): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  parent.appendChild(b);
  stub(b, r);
  return b;
}

const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

describe('SpatialNav', () => {
  let root: HTMLElement;
  let nav: SpatialNav;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    TestBed.configureTestingModule({});
    nav = TestBed.inject(SpatialNav);
    nav.attach(document);
  });

  afterEach(() => {
    nav.detach();
    root.remove();
  });

  it('moves the focus with the arrow keys on a 3 x 3 grid and swallows the key', () => {
    const b = Array.from({ length: 9 }, (_, i) => button(root, `b${i}`, rect((i % 3) * 120, Math.floor(i / 3) * 70)));
    b[4].focus();
    const e = key(b[4], 'ArrowRight');
    expect(document.activeElement).toBe(b[5]);
    expect(e.defaultPrevented).toBe(true);
    key(b[5], 'ArrowDown');
    expect(document.activeElement).toBe(b[8]);
    key(b[8], 'ArrowLeft');
    expect(document.activeElement).toBe(b[7]);
    key(b[7], 'ArrowUp');
    expect(document.activeElement).toBe(b[4]);
  });

  it('ArrowUp from the top row stays (and still swallows the key, so the page does not scroll)', () => {
    const top = button(root, 'top', rect(0, 0));
    button(root, 'below', rect(0, 100));
    top.focus();
    const e = key(top, 'ArrowUp');
    expect(document.activeElement).toBe(top);
    expect(e.defaultPrevented).toBe(true);
  });

  it('skips disabled, hidden and zero-size elements and tabindex -1', () => {
    const a = button(root, 'a', rect(0, 0));
    const disabled = button(root, 'disabled', rect(0, 60));
    disabled.disabled = true;
    const zero = button(root, 'zero', 'hidden');
    const hiddenAttr = button(root, 'hiddenAttr', rect(0, 100));
    hiddenAttr.hidden = true;
    const out = button(root, 'out', rect(0, 140));
    out.tabIndex = -1;
    const c = button(root, 'c', rect(0, 200));
    a.focus();
    key(a, 'ArrowDown');
    expect(document.activeElement).toBe(c);
    void zero;
  });

  it('focuses the first thing when nothing has the focus', () => {
    const a = button(root, 'a', rect(0, 0));
    button(root, 'b', rect(0, 60));
    (document.activeElement as HTMLElement | null)?.blur();
    key(document.body, 'ArrowDown');
    expect(document.activeElement).toBe(a);
  });

  it('Enter clicks something that is focusable but not a control; buttons do their own', () => {
    const div = document.createElement('div');
    div.tabIndex = 0;
    root.appendChild(div);
    stub(div, rect(0, 0));
    const clicked = vi.fn();
    div.addEventListener('click', clicked);
    div.focus();
    key(div, 'Enter');
    expect(clicked).toHaveBeenCalledTimes(1);

    const b = button(root, 'b', rect(0, 60));
    const bClicked = vi.fn();
    b.addEventListener('click', bClicked);
    b.focus();
    const e = key(b, 'Enter');
    expect(bClicked).not.toHaveBeenCalled(); // the browser clicks a button itself
    expect(e.defaultPrevented).toBe(false);
  });

  it('leaves a text field with up and down, and with left and right only at its ends', () => {
    const above = button(root, 'above', rect(0, 0));
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'abc';
    root.appendChild(input);
    stub(input, rect(0, 60));
    const below = button(root, 'below', rect(0, 120));
    const left = button(root, 'left', rect(-200, 60));

    input.focus();
    input.setSelectionRange(1, 1);
    let e = key(input, 'ArrowLeft');
    expect(document.activeElement, 'caret in the middle: the key moves the caret').toBe(input);
    expect(e.defaultPrevented).toBe(false);

    input.setSelectionRange(0, 0);
    e = key(input, 'ArrowLeft');
    expect(document.activeElement, 'caret at the start: left leaves').toBe(left);
    expect(e.defaultPrevented).toBe(true);

    input.focus();
    key(input, 'ArrowDown');
    expect(document.activeElement).toBe(below);
    input.focus();
    key(input, 'ArrowUp');
    expect(document.activeElement).toBe(above);
  });

  it('ignores keys with a modifier', () => {
    const a = button(root, 'a', rect(0, 0));
    button(root, 'b', rect(0, 60));
    a.focus();
    const e = key(a, 'ArrowDown', { altKey: true });
    expect(document.activeElement).toBe(a);
    expect(e.defaultPrevented).toBe(false);
  });

  it('looks inside a data-nav-group first, and leaves it only when nothing in it lies that way', () => {
    const group = document.createElement('div');
    group.setAttribute('data-nav-group', '');
    root.appendChild(group);
    const a1 = button(group, 'a1', rect(0, 0));
    const a2 = button(group, 'a2', rect(0, 100));
    const x = button(root, 'x', rect(0, 55, 100, 40)); // outside the group, between a1 and a2: nearer to a1 than a2 is
    const far = button(root, 'far', rect(300, 0));

    a1.focus();
    key(a1, 'ArrowDown');
    expect(document.activeElement, 'the group wins over a nearer outsider').toBe(a2);
    a1.focus();
    key(a1, 'ArrowRight');
    expect(document.activeElement, 'nothing in the group to the right: out of the group').toBe(far);
    void x;
  });

  it('stops listening after detach', () => {
    const a = button(root, 'a', rect(0, 0));
    button(root, 'b', rect(0, 60));
    nav.detach();
    a.focus();
    key(a, 'ArrowDown');
    expect(document.activeElement).toBe(a);
  });

  it('scrolls the new focus into view', () => {
    const a = button(root, 'a', rect(0, 0));
    const b = button(root, 'b', rect(0, 60));
    b.scrollIntoView = vi.fn();
    a.focus();
    key(a, 'ArrowDown');
    expect(b.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });
});
