import { TestBed } from '@angular/core/testing';
import { ENVIRONMENT } from './environment';
import { KeyboardShortcuts, SHORTCUTS } from './shortcuts';

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, ...init });
  Object.defineProperty(e, 'target', { value: target });
  return e;
};

describe('KeyboardShortcuts', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  const service = () => TestBed.inject(KeyboardShortcuts);

  it('accepts a plain key on the page', () => {
    expect(service().accepts(press('n'))).toBe(true);
  });

  it('is on by default; turning it off is remembered and turns every shortcut off (WCAG 2.1.4)', () => {
    expect(service().enabled()).toBe(true);
    service().setEnabled(false);
    expect(service().accepts(press('n'))).toBe(false);
    expect(localStorage.getItem('kantahe.shortcuts.off')).toBe('1');
    TestBed.resetTestingModule();
    expect(service().enabled()).toBe(false);
    service().setEnabled(true);
    expect(localStorage.getItem('kantahe.shortcuts.off')).toBeNull();
  });

  it('REGRESSION: never while typing: an input, a select, a textarea or editable text', () => {
    const input = document.createElement('input');
    const select = document.createElement('select');
    const area = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    for (const el of [input, select, area, editable]) {
      document.body.appendChild(el);
      expect(service().accepts(press('n', {}, el)), el.tagName).toBe(false);
      el.remove();
    }
  });

  it('never with Ctrl, Alt or Meta held (the browser\'s own shortcuts)', () => {
    for (const init of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) expect(service().accepts(press('n', init))).toBe(false);
  });

  it('Space on a focused button or link is that control\'s own press, not a shortcut; other keys still work there', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    expect(service().accepts(press(' ', {}, button))).toBe(false);
    expect(service().accepts(press('n', {}, button))).toBe(true);
    button.remove();
  });

  it('a key held down is one press', () => {
    expect(service().accepts(press('n', { repeat: true }))).toBe(false);
    expect(service().accepts(press('+', { repeat: true }), true)).toBe(true); // volume may repeat
  });

  it('never on a TV build (the remote\'s keys mean something else there)', () => {
    TestBed.configureTestingModule({ providers: [{ provide: ENVIRONMENT, useValue: { isTv: true } }] });
    expect(service().accepts(press('n'))).toBe(false);
  });

  it('nothing else acts while the list of shortcuts is open', () => {
    service().helpOpen.set(true);
    expect(service().accepts(press('n'))).toBe(false);
  });

  it('lists every shortcut once, with where it works', () => {
    expect(SHORTCUTS.map((s) => s.keys)).toEqual(['Space or K', 'N', 'F', '+ and −', 'V', '/', '?']);
    for (const s of SHORTCUTS) expect([s.does, s.where].every((t) => t.length > 0)).toBe(true);
  });
});
