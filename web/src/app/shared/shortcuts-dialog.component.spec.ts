import { TestBed } from '@angular/core/testing';
import { KeyboardShortcuts, SHORTCUTS } from '../core/shortcuts';
import { ShortcutsDialogComponent } from './shortcuts-dialog.component';

describe('ShortcutsDialogComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(ShortcutsDialogComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const shortcuts = TestBed.inject(KeyboardShortcuts);
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, el: fixture.nativeElement as HTMLElement, shortcuts, settle };
  }
  afterEach(() => document.body.querySelectorAll('app-shortcuts-dialog').forEach((e) => e.remove()));

  it('is not there until it is asked for', () => {
    expect(render().el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens as a modal dialog with a title and every shortcut, and the focus goes into it', async () => {
    const { el, shortcuts, settle } = render();
    shortcuts.helpOpen.set(true);
    await settle();
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toContain('Keyboard shortcuts');
    expect(Array.from(dialog.querySelectorAll('tbody tr')).map((r) => r.querySelector('kbd')?.textContent)).toEqual(SHORTCUTS.map((s) => s.keys));
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Escape closes it and the focus goes back to where it was', async () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    before.focus();
    const { el, shortcuts, settle } = render();
    shortcuts.helpOpen.set(true);
    await settle();
    el.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(shortcuts.helpOpen()).toBe(false);
    expect(document.activeElement).toBe(before);
    before.remove();
  });

  it('the Close button closes it too, and Tab keeps the focus inside', async () => {
    const { el, shortcuts, settle } = render();
    shortcuts.helpOpen.set(true);
    await settle();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    el.querySelector('[role="dialog"]')!.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    el.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click();
    await settle();
    expect(shortcuts.helpOpen()).toBe(false);
  });
});
