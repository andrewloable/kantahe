import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
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
      ['Password', '/me/password'],
      ['Approve a TV', '/code'],
    ]);
    expect(el.textContent).toContain('child page');
  });

  it('marks the page you are on', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/me/history', MePage);
    const current = (harness.fixture.nativeElement as HTMLElement).querySelector('nav a[aria-current="page"]');
    expect(current?.textContent?.trim()).toBe('History');
  });

  it('regression: the links of the account menu are at least 44 px high and wide (40 px high, "Score" 42 px wide, before)', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/me/favourites', MePage);
    const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
    expect(css).toMatch(/nav\[[^\]]*\]\s+a\[[^\]]*\]\s*\{[^}]*min-height:\s*2\.75rem[^}]*min-width:\s*2\.75rem/);
  });
});
