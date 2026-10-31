import { TestBed } from '@angular/core/testing';
import { BACK_ACTIONS, BackKeys, registerMediaKeys } from './back-keys';

const keydown = (keyCode: number, target: EventTarget = document) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'keyCode', { value: keyCode });
  target.dispatchEvent(e);
  return e;
};

describe('BackKeys', () => {
  let back: ReturnType<typeof vi.fn<() => void>>;
  let exit: ReturnType<typeof vi.fn<() => void>>;
  let keys: BackKeys;
  let canGoBack = true;

  beforeEach(() => {
    canGoBack = true;
    back = vi.fn<() => void>();
    exit = vi.fn<() => void>();
    TestBed.configureTestingModule({ providers: [{ provide: BACK_ACTIONS, useValue: { back, exit, canGoBack: () => canGoBack } }] });
    keys = TestBed.inject(BackKeys);
    keys.attach(document);
  });

  afterEach(() => {
    keys.detach();
    document.querySelectorAll('[data-back-closes]').forEach((e) => e.remove());
  });

  it('the Tizen Back key (10009) goes back', () => {
    const e = keydown(10009);
    expect(back).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
  });

  it('the webOS Back key (461) goes back', () => {
    keydown(461);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('other keys do nothing, Backspace in particular (it belongs to text fields)', () => {
    const e = keydown(8);
    keydown(27);
    expect(back).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it('with nothing to go back to, Back leaves the app', () => {
    canGoBack = false;
    keydown(10009);
    expect(back).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('closes an overlay first: Escape goes to it, the page does not go back', () => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-back-closes', '');
    document.body.appendChild(overlay);
    const escapes: string[] = [];
    overlay.addEventListener('keydown', (e) => escapes.push((e as KeyboardEvent).key));
    keydown(461);
    expect(escapes).toEqual(['Escape']);
    expect(back).not.toHaveBeenCalled();
  });

  it('with several overlays the last one in the page is closed', () => {
    const [a, b] = [document.createElement('div'), document.createElement('div')];
    for (const o of [a, b]) {
      o.setAttribute('data-back-closes', '');
      document.body.appendChild(o);
    }
    const hits: string[] = [];
    a.addEventListener('keydown', () => hits.push('a'));
    b.addEventListener('keydown', () => hits.push('b'));
    keydown(10009);
    expect(hits).toEqual(['b']);
  });

  it('stops listening after detach', () => {
    keys.detach();
    keydown(10009);
    expect(back).not.toHaveBeenCalled();
  });
});

describe('registerMediaKeys', () => {
  it('asks Tizen for every media key', () => {
    const registerKey = vi.fn();
    registerMediaKeys({ tizen: { tvinputdevice: { registerKey } } } as never);
    expect(registerKey.mock.calls.map((c) => c[0])).toEqual(['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaFastForward', 'MediaRewind']);
  });

  it('does nothing where there is no Tizen API', () => {
    expect(() => registerMediaKeys({} as never)).not.toThrow();
  });

  it('carries on when a key cannot be registered', () => {
    const registerKey = vi.fn((name: string) => {
      if (name === 'MediaPause') throw new Error('unsupported');
    });
    registerMediaKeys({ tizen: { tvinputdevice: { registerKey } } } as never);
    expect(registerKey).toHaveBeenCalledTimes(6);
  });
});
