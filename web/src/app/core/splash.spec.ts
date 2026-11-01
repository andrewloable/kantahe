import { removeSplash } from './splash';

// jsdom has no matchMedia, and the spec files of one worker share a window: define it for the test and put back what was there
const had = Object.getOwnPropertyDescriptor(window, 'matchMedia');

function page(): { splash: HTMLElement; reduced: (on: boolean) => void } {
  document.body.innerHTML = '<div id="splash" role="status"></div><app-root></app-root>';
  let reduce = false;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({ matches: reduce && q.includes('reduce'), media: q }) as MediaQueryList,
  });
  return { splash: document.getElementById('splash')!, reduced: (on) => (reduce = on) };
}

describe('removeSplash', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    if (had) Object.defineProperty(window, 'matchMedia', had);
    else delete (window as { matchMedia?: unknown }).matchMedia;
    document.body.innerHTML = '';
  });

  it('fades the splash out and removes it when the fade has ended', () => {
    const { splash } = page();
    removeSplash(document);
    expect(splash.classList.contains('done')).toBe(true);
    expect(document.getElementById('splash')).not.toBeNull(); // still there while it fades
    splash.dispatchEvent(new Event('transitionend'));
    expect(document.getElementById('splash')).toBeNull();
  });

  it('removes it after the safety timeout when no transition event ever comes', () => {
    page();
    removeSplash(document);
    vi.advanceTimersByTime(599);
    expect(document.getElementById('splash')).not.toBeNull();
    vi.advanceTimersByTime(2);
    expect(document.getElementById('splash')).toBeNull();
  });

  it('calling it twice is harmless', () => {
    const { splash } = page();
    removeSplash(document);
    removeSplash(document);
    splash.dispatchEvent(new Event('transitionend'));
    vi.advanceTimersByTime(1000); // the safety timeout of the first call finds nothing left to do
    expect(document.getElementById('splash')).toBeNull();
    expect(() => removeSplash(document)).not.toThrow();
  });

  it('does nothing when there is no splash (the Flutter WebView, a test page)', () => {
    document.body.innerHTML = '<app-root></app-root>';
    expect(() => removeSplash(document)).not.toThrow();
    expect(document.querySelector('app-root')).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('with reduced motion it goes at once, with no fade', () => {
    const { splash, reduced } = page();
    reduced(true);
    removeSplash(document);
    expect(document.getElementById('splash')).toBeNull();
    expect(splash.classList.contains('done')).toBe(false);
  });
});
