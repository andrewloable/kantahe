import { TestBed } from '@angular/core/testing';
import { INSTALL_ENV, InstallPrompt } from '../core/install';
import { InstallGuideDialogComponent } from './install-guide-dialog.component';

describe('InstallGuideDialogComponent', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: INSTALL_ENV,
          useValue: { target: new EventTarget(), secure: true, userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5, standaloneNav: false, displayStandalone: () => false, now: () => 1 },
        },
      ],
    });
    const fixture = TestBed.createComponent(InstallGuideDialogComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const install = TestBed.inject(InstallPrompt);
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { el: fixture.nativeElement as HTMLElement, install, settle };
  }
  afterEach(() => document.body.querySelectorAll('app-install-guide-dialog').forEach((e) => e.remove()));

  it('is closed until asked for', () => {
    expect(render().el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows the three steps for an iPhone as a modal dialog with the focus inside', async () => {
    const { el, install, settle } = render();
    install.guideOpen.set(true);
    await settle();
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(Array.from(dialog.querySelectorAll('ol li')).map((li) => li.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Tap the Share button.',
      'Choose Add to Home Screen.',
      'Tap Add.',
    ]);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Escape and Close close it and the focus goes back', async () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    before.focus();
    const { el, install, settle } = render();
    install.guideOpen.set(true);
    await settle();
    el.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(install.guideOpen()).toBe(false);
    expect(document.activeElement).toBe(before);
    install.guideOpen.set(true);
    await settle();
    el.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click();
    await settle();
    expect(install.guideOpen()).toBe(false);
    before.remove();
  });
});
