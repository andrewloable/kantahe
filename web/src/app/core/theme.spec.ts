import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme';

const root = document.documentElement;

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
  });
  afterEach(() => root.removeAttribute('data-theme'));

  it('follows the system until told otherwise: no theme attribute on the page', () => {
    expect(TestBed.inject(ThemeService).mode()).toBe('auto');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('Dark and Light set the attribute and are remembered', () => {
    const t = TestBed.inject(ThemeService);
    t.set('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('kantahe.theme')).toBe('dark');
    t.set('light');
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(t.mode()).toBe('light');
  });

  it('Auto takes the attribute away again and forgets the choice', () => {
    const t = TestBed.inject(ThemeService);
    t.set('dark');
    t.set('auto');
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('kantahe.theme')).toBeNull();
  });

  it('a stored choice is applied when the app starts', () => {
    localStorage.setItem('kantahe.theme', 'dark');
    const t = TestBed.inject(ThemeService);
    t.apply();
    expect(t.mode()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('a stored value that is not a theme counts as Auto', () => {
    localStorage.setItem('kantahe.theme', 'purple');
    const t = TestBed.inject(ThemeService);
    t.apply();
    expect(t.mode()).toBe('auto');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('works when the browser will not store anything', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const t = TestBed.inject(ThemeService);
    t.set('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    vi.restoreAllMocks();
  });
});
