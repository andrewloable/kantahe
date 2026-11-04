import { TestBed } from '@angular/core/testing';
import { BadgeLegendComponent } from './badge-legend.component';

const KEY = 'kantahe.legend.hidden';

describe('BadgeLegendComponent', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  function render() {
    const fixture = TestBed.createComponent(BadgeLegendComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
    return { fixture, el, button };
  }

  it('shows W, L and V in the badge style with what each means', () => {
    const { el } = render();
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('W word-by-word lyrics · L line-by-line lyrics · V separate vocals');
    expect(el.querySelectorAll('app-format-badge .flag')).toHaveLength(3);
  });

  it('Hide hides it, remembers that in this browser, and a new page starts hidden', () => {
    const { fixture, el, button } = render();
    button('Hide')!.click();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('word-by-word');
    expect(localStorage.getItem(KEY)).toBe('1');
    const again = render();
    expect(again.el.textContent).not.toContain('word-by-word');
  });

  it('what is left when hidden brings it back, and that is remembered too', () => {
    localStorage.setItem(KEY, '1');
    const { fixture, el, button } = render();
    button('What do W, L and V mean?')!.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('word-by-word');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('the badges are for the eye: the words say it, so a screen reader does not read both', () => {
    const { el } = render();
    expect(el.querySelector('.samples')?.getAttribute('aria-hidden')).toBe('true');
  });
});
