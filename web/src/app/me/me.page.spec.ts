import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { INSTALL_ENV } from '../core/install';
import { MePage } from './me.page';

@Component({ template: '<p>child page</p>' })
class Child {}

describe('MePage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'me', component: MePage, children: [{ path: 'favourites', component: Child }, { path: 'history', component: Child }] }])],
    });
  });

  it('has a menu of the account pages and a place for the page', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/me/favourites', MePage);
    const el = harness.fixture.nativeElement as HTMLElement;
    const nav = el.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('My account');
    expect(Array.from(nav!.querySelectorAll('a')).map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['Favourites', '/me/favourites'],
      ['History', '/me/history'],
      ['Playlists', '/me/playlists'],
      ['Devices', '/me/devices'],
      ['Score', '/me/settings'],
      ['Appearance and account', '/me/appearance'],
      ['Password', '/me/password'],
      ['Help', '/me/help'],
      ['Approve a TV', '/me/approve-tv'],
    ]);
    expect(el.textContent).toContain('child page');
  });

  it('has an Install the app entry only where the app can be installed, and it opens the same action (kantahe-8ib.1)', async () => {
    const env = { target: new EventTarget(), secure: true, userAgent: 'Android Mobile', platform: 'Linux', maxTouchPoints: 5, standaloneNav: false, displayStandalone: () => false, now: () => 1 };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'me', component: MePage, children: [{ path: 'favourites', component: Child }] }]), { provide: INSTALL_ENV, useValue: env }],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/me/favourites', MePage);
    const el = harness.fixture.nativeElement as HTMLElement;
    const entry = () => Array.from(el.querySelectorAll('nav button')).find((b) => b.textContent?.trim() === 'Install the app') as HTMLButtonElement | undefined;
    expect(entry()).toBeUndefined();
    const prompt = vi.fn(() => Promise.resolve());
    env.target.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) }));
    harness.fixture.detectChanges();
    expect(entry()).toBeDefined();
    entry()!.click();
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('marks the page you are on', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/me/history', MePage);
    const current = (harness.fixture.nativeElement as HTMLElement).querySelector('nav a[aria-current="page"]');
    expect(current?.textContent?.trim()).toBe('History');
  });

  it('the account menu uses the shared tab look (global .sub-nav; its 44 px size is checked in the browser by e2e/visual-consistency.spec.ts)', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/me/favourites', MePage);
    expect((harness.routeNativeElement as HTMLElement).querySelector('nav')?.classList.contains('sub-nav')).toBe(true);
  });
});
