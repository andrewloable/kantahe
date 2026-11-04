import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { createRouterTransport } from '@connectrpc/connect';
import { AuthService, LogoutResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { KeyboardShortcuts } from '../core/shortcuts';
import { ThemeService } from '../core/theme';
import { AppearanceComponent } from './appearance.component';

describe('AppearanceComponent', () => {
  let logouts = 0;
  beforeEach(() => {
    localStorage.clear();
    logouts = 0;
    const transport = createRouterTransport(({ service }) =>
      service(AuthService, {
        logout() {
          logouts++;
          return create(LogoutResponseSchema, {});
        },
      }),
    );
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }]), { provide: TRANSPORT, useValue: transport }] });
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { email: 'ana@example.com' }) }));
  });
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  async function render() {
    const fixture = TestBed.createComponent(AppearanceComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('offers Auto (system), Light and Dark as radio buttons with the current choice checked', async () => {
    TestBed.inject(ThemeService).set('light');
    const { el } = await render();
    const radios = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="radio"][name="theme"]'));
    expect(radios.map((r) => [r.value, el.querySelector(`label[for="${r.id}"]`)?.textContent?.trim(), r.checked])).toEqual([
      ['auto', 'Auto (system)', false],
      ['light', 'Light', true],
      ['dark', 'Dark', false],
    ]);
    expect(el.querySelector('fieldset legend')?.textContent?.trim()).toBe('Theme');
  });

  it('choosing Dark sets the theme and keeps it in this browser (the same key as before)', async () => {
    const { el, fixture } = await render();
    const dark = el.querySelector<HTMLInputElement>('input[value="dark"]')!;
    dark.checked = true;
    dark.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('kantahe.theme')).toBe('dark');
  });

  it('has a switch for the keyboard shortcuts, on by default, that turns them off and on (WCAG 2.1.4)', async () => {
    const { el, fixture } = await render();
    const box = el.querySelector<HTMLInputElement>('input#shortcuts')!;
    expect(el.querySelector('label[for="shortcuts"]')?.textContent?.trim()).toBe('Keyboard shortcuts');
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    expect(TestBed.inject(KeyboardShortcuts).enabled()).toBe(false);
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(TestBed.inject(KeyboardShortcuts).enabled()).toBe(true);
  });

  it('shows who is signed in, and Sign out tells the server, forgets the token and goes to the sign-in page', async () => {
    const { el, fixture } = await render();
    expect(el.textContent).toContain('ana@example.com');
    const button = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Sign out')!;
    button.click();
    await fixture.whenStable();
    expect(logouts).toBe(1);
    expect(TestBed.inject(AuthStore).token()).toBeUndefined();
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
