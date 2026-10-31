import { TestBed } from '@angular/core/testing';
import { TempPasswordPanelComponent } from './temp-password-panel.component';

function setup(clipboard?: { writeText: (s: string) => Promise<void> }) {
  if (clipboard) Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
  else Reflect.deleteProperty(navigator, 'clipboard');
  const fixture = TestBed.createComponent(TempPasswordPanelComponent);
  fixture.componentRef.setInput('email', 'ann@example.com');
  fixture.componentRef.setInput('password', 'Abcd2345wxyz');
  const closed = vi.fn();
  fixture.componentInstance.closed.subscribe(closed);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const button = (name: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === name)!;
  return { fixture, el, closed, button };
}

describe('TempPasswordPanelComponent', () => {
  afterEach(() => Reflect.deleteProperty(navigator, 'clipboard'));

  it('shows the password for the user, in a box that can be selected, and says it is shown once', () => {
    const { el } = setup();
    const box = el.querySelector<HTMLInputElement>('input')!;
    expect(box.value).toBe('Abcd2345wxyz');
    expect(box.readOnly).toBe(true);
    expect(el.querySelector(`label[for="${box.id}"]`)?.textContent).toContain('Temporary password for ann@example.com');
    expect(el.textContent).toContain('shown only now');
    expect(el.textContent).toContain('must change it');
  });

  it('copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { button, fixture, el } = setup({ writeText });
    button('Copy').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(writeText).toHaveBeenCalledWith('Abcd2345wxyz');
    expect(el.textContent).toContain('Copied');
  });

  it('says how to copy when the browser will not', async () => {
    const { button, fixture, el } = setup();
    button('Copy').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Select the password and copy it');
  });

  it('says so when copying is refused', async () => {
    const { button, fixture, el } = setup({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    button('Copy').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Select the password and copy it');
  });

  it('Close tells the owner to hide it', () => {
    const { button, closed } = setup();
    button('Close').click();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('is never written to storage', () => {
    setup();
    expect(JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })).not.toContain('Abcd2345wxyz');
  });
});
