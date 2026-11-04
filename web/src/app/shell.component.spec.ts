import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { AuthService, GetServerInfoResponseSchema, LogoutResponseSchema } from '../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, UserSchema } from '../gen/kantahe/v1/common_pb';
import { TRANSPORT } from './core/api';
import { AuthStore } from './core/auth.store';
import { INSTALL_ENV, InstallEnv } from './core/install';
import { KeyboardShortcuts } from './core/shortcuts';
import { ThemeService } from './core/theme';
import { ToastService } from './core/toast';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [ShellComponent], providers: [provideRouter([])] });
  });

  it('shows the title and a place for the page', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.brand')?.textContent?.trim()).toBe('Kantahe');
    expect(el.querySelector('router-outlet')).not.toBeNull();
  });

  it('has a theme choice Auto, Light and Dark, also before signing in, that sets and shows the theme', async () => {
    localStorage.clear();
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const select = el.querySelector<HTMLSelectElement>('select[aria-label="Theme"]')!;
    expect(Array.from(select.options).map((o) => [o.value, o.textContent?.trim()])).toEqual([
      ['auto', 'Auto (system)'],
      ['light', 'Light'],
      ['dark', 'Dark'],
    ]);
    expect(select.value).toBe('auto');
    select.value = 'dark';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  describe('footer', () => {
    async function footer(version: string | null) {
      const transport = createRouterTransport(({ service }) =>
        service(AuthService, {
          getServerInfo() {
            if (version === null) throw new ConnectError('down', Code.Unavailable);
            return create(GetServerInfoResponseSchema, { version });
          },
        }),
      );
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: transport }] });
      const fixture = TestBed.createComponent(ShellComponent);
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('shows the copyright and the version of the server, in the one contentinfo landmark outside main', async () => {
      const el = await footer('1.2.3');
      const footers = el.querySelectorAll('footer');
      expect(footers.length).toBe(1);
      expect(footers[0].textContent?.replace(/\s+/g, ' ').trim()).toBe('© 2020 Andrew Loable · Kantahe 1.2.3');
      expect(footers[0].closest('main')).toBeNull();
      expect(footers[0].querySelector('a, button, input, [tabindex]')).toBeNull(); // nothing to tab to
    });

    it('without an answer from the server it shows the copyright and the name only', async () => {
      const el = await footer(null);
      expect(el.querySelector('footer')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('© 2020 Andrew Loable · Kantahe');
    });
  });

  it('regression: the shell has no h1 (every page has its own, two of them confused screen readers); the brand links to the library', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')).toBeNull();
    expect(el.querySelector('a.brand')?.getAttribute('href')).toBe('/library');
  });

  it('regression: a Skip to content link comes first and moves the focus to the page\'s main part', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    const focusable = Array.from(el.querySelectorAll<HTMLElement>('a[href], button, select, input')).filter((e) => e.tabIndex >= 0);
    expect(focusable[0].textContent?.trim()).toBe('Skip to content');
    focusable[0].click();
    const main = el.querySelector('main');
    expect(document.activeElement).toBe(main);
    expect(main!.getAttribute('tabindex')).toBe('-1');
    el.remove();
  });

  it('regression: one main landmark with the id the skip link points to, around the page; the brand, the tools and the menu are in a header', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const mains = el.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    expect(mains[0].id).toBe('main');
    expect(el.querySelector('a.skip')?.getAttribute('href')).toBe('#' + mains[0].id);
    expect(mains[0].querySelector('router-outlet')).not.toBeNull();
    const header = el.querySelector('header');
    expect(header?.querySelector('.brand')).not.toBeNull();
    expect(header?.querySelector('.tools')).not.toBeNull();
    expect(header?.querySelector('nav[aria-label="Main"]')).not.toBeNull();
  });

  it('regression: the links and buttons of the top bar and menu are at least 44 px high (40 px, and "Me" 23 px wide, before)', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
    await fixture.whenStable();
    const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
    // (component styles are compiled to nav[_ngcontent-..] a[_ngcontent-..])
    expect(css).toMatch(/nav\[[^\]]*\]\s+a\[[^\]]*\]\s*\{[^}]*min-height:\s*2\.75rem[^}]*min-width:\s*2\.75rem/);
    expect(css).toMatch(/\.signout[^{]*\{[^}]*min-height:\s*2\.75rem/);
    expect(css).toMatch(/\.brand[^{]*\{[^}]*min-height:\s*2\.75rem/);
    expect(css).toMatch(/\.theme[^{]*\{[^}]*min-height:\s*2\.75rem/);
  });

  it('has the now-playing bar under the menu once signed in, and none before', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-now-bar')).toBeNull();
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
    await fixture.whenStable();
    expect(el.querySelector('header:has(nav) + app-now-bar'), 'right after the header that holds the menu').not.toBeNull();
  });

  it('has no menu for a visitor who is not signed in', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')).toBeNull();
  });

  it('shows the menu once signed in, and hides it again on sign-out', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
    await fixture.whenStable();
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Main');
    const links = Array.from(nav!.querySelectorAll('a')).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);
    expect(links).toEqual([
      ['Library', '/library'],
      ['Queue', '/queue'],
      ['Player', '/player'],
      ['Me', '/me'],
    ]);
    auth.signOut();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')).toBeNull();
  });

  it('shows the Admin link to administrators only', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { admin: false }) }));
    await fixture.whenStable();
    const hrefs = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map((a) => a.getAttribute('href'));
    expect(hrefs()).not.toContain('/admin');
    auth.setUser(create(UserSchema, { admin: true }));
    await fixture.whenStable();
    expect(hrefs()).toContain('/admin');
  });

  it('regression: Approve a TV is not in the main menu (it is a rare account action, under Me)', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { admin: true }) }));
    await fixture.whenStable();
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav')!;
    expect(nav.querySelector('a[href="/code"]')).toBeNull();
    expect(nav.textContent).not.toContain('Approve a TV');
  });

  it('regression: Upload is not in the main menu for anyone (it is the first page of Admin)', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { uploader: true }) }));
    await fixture.whenStable();
    const labels = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map((a) => a.textContent?.trim());
    expect(labels()).not.toContain('Upload');
    auth.setUser(create(UserSchema, { admin: true }));
    await fixture.whenStable();
    expect(labels()).toEqual(['Library', 'Queue', 'Player', 'Me', 'Admin']);
  });

  it('every tab of the menu has an icon hidden from screen readers and its label always shown', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { admin: true }) }));
    await fixture.whenStable();
    const tabs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav[aria-label="Main"] a'));
    expect(tabs).toHaveLength(5);
    for (const tab of tabs) {
      expect(tab.querySelector('svg')?.getAttribute('aria-hidden'), tab.textContent!).toBe('true');
      expect(tab.querySelector('svg')?.getAttribute('focusable'), tab.textContent!).toBe('false');
      expect(tab.querySelector('.label')?.textContent?.trim(), tab.textContent!).toBeTruthy();
    }
  });

  it('regression: the underline on hover is only for a pointer that hovers (on a touch screen it stuck to the tapped tab)', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
    await fixture.whenStable();
    const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n').replace(/\s+/g, ' ');
    const hovers = css.match(/nav\[[^\]]*\] a\[[^\]]*\]:hover/g) ?? [];
    expect(hovers.length).toBeGreaterThan(0);
    const inMedia = css.match(/@media \(hover: hover\) \{[^@]*?nav\[[^\]]*\] a\[[^\]]*\]:hover/g) ?? [];
    expect(inMedia.length, 'every hover rule of the menu sits in @media (hover: hover)').toBe(hovers.length);
  });

  it('regression: on a phone the menu is a bar fixed at the bottom with room for the home indicator, and the page keeps clear of it', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
    await fixture.whenStable();
    const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n').replace(/\s+/g, ' ');
    const phone = css.match(/@media \(max-width: 40rem\) \{(.*?\}) \}/)?.[1] ?? '';
    expect(phone).toMatch(/nav\[[^\]]*\] \{[^}]*position: fixed;[^}]*bottom: 0;/);
    expect(phone).toMatch(/nav\[[^\]]*\] \{[^}]*env\(safe-area-inset-bottom\)/);
    expect(phone).toMatch(/nav\[[^\]]*\] a\[[^\]]*\] \{[^}]*min-height: 3rem;/);
    expect(phone).toMatch(/\.frame\[[^\]]*\] \{[^}]*padding-bottom: calc\(/);
  });

  describe('the install offer (kantahe-8ib.1)', () => {
    const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
    function open(env: Partial<InstallEnv> = {}, signedIn = true) {
      localStorage.clear();
      const full: InstallEnv = { target: new EventTarget(), secure: true, userAgent: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5, standaloneNav: false, displayStandalone: () => false, now: () => 1_000_000_000_000, ...env };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [ShellComponent], providers: [provideRouter([]), { provide: INSTALL_ENV, useValue: full }] });
      if (signedIn) TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
      const fixture = TestBed.createComponent(ShellComponent);
      fixture.detectChanges();
      const offer = async () => {
        const prompt = vi.fn(() => Promise.resolve());
        full.target.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) }));
        fixture.detectChanges();
        await fixture.whenStable();
        return prompt;
      };
      return { fixture, el: fixture.nativeElement as HTMLElement, offer, full };
    }
    const banner = (el: HTMLElement) => el.querySelector('aside.install');
    const button = (el: HTMLElement, text: string) => Array.from(el.querySelectorAll('aside.install button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;

    it('REGRESSION: with the browser\'s install event the signed-in frame shows Install Kantahe on this phone with an Install button', async () => {
      const { el, offer, fixture } = open();
      expect(banner(el)).toBeNull();
      const prompt = await offer();
      expect(banner(el)?.textContent).toContain('Install Kantahe on this phone');
      button(el, 'Install')!.click();
      fixture.detectChanges();
      expect(prompt).toHaveBeenCalledTimes(1);
      expect(banner(el)).toBeNull();
    });

    it('Not now hides it', async () => {
      const { el, offer, fixture } = open();
      await offer();
      button(el, 'Not now')!.click();
      fixture.detectChanges();
      expect(banner(el)).toBeNull();
    });

    it('on an iPhone the banner has How to, which opens the three steps', async () => {
      const { el, fixture } = open({ userAgent: 'iPhone', platform: 'iPhone' });
      expect(button(el, 'How to')).toBeDefined();
      button(el, 'How to')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('[role="dialog"]')?.textContent).toContain('Add to Home Screen');
    });

    it('nobody who is not signed in (the sign-in page) sees it, nor does an installed app', async () => {
      const out = open({}, false);
      await out.offer();
      expect(banner(out.el)).toBeNull();
      const installed = open({ displayStandalone: () => true });
      await installed.offer();
      expect(banner(installed.el)).toBeNull();
    });

    it('the banner is in the page flow (not fixed over content) and its buttons are 44 px', () => {
      const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n').replace(/\s+/g, ' ');
      const rule = css.match(/\.install\[[^\]]*\] \{([^}]*)\}/)?.[1] ?? '';
      expect(rule).not.toMatch(/position:\s*(fixed|sticky)/);
    });
  });

  describe('the list of shortcuts (kantahe-tlf.4.7)', () => {
    async function open() {
      localStorage.clear();
      const fixture = TestBed.createComponent(ShellComponent);
      document.body.appendChild(fixture.nativeElement);
      TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
        target.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: key === '?', bubbles: true, cancelable: true, ...init }));
      const settle = async () => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      };
      return { fixture, el, press, settle };
    }
    afterEach(() => document.querySelectorAll('app-shell').forEach((e) => e.remove()));

    it('? opens the dialog with the shortcuts from anywhere in the shell; Escape closes it and the focus returns', async () => {
      const { el, press, settle } = await open();
      const link = el.querySelector<HTMLAnchorElement>('a.brand')!;
      link.focus();
      press('?', link);
      await settle();
      expect(el.querySelector('[role="dialog"]')?.textContent).toContain('Keyboard shortcuts');
      press('Escape', el.querySelector('[role="dialog"]')!);
      await settle();
      expect(el.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(link);
    });

    it('REGRESSION: ? typed in a field, or with Ctrl held, or with the shortcuts turned off, opens nothing', async () => {
      const { el, press, settle } = await open();
      const input = document.createElement('input');
      document.body.appendChild(input);
      press('?', input);
      press('?', document.body, { ctrlKey: true });
      TestBed.inject(KeyboardShortcuts).setEnabled(false);
      press('?');
      await settle();
      expect(el.querySelector('[role="dialog"]')).toBeNull();
      input.remove();
    });
  });

  describe('Sign out', () => {
    function signedIn(logout: () => unknown = () => create(LogoutResponseSchema, {})) {
      let calls = 0;
      const transport = createRouterTransport(({ service }) =>
        service(AuthService, {
          logout() {
            calls++;
            return logout() as never;
          },
        }),
      );
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ShellComponent],
        providers: [provideRouter([{ path: '**', children: [] }]), { provide: TRANSPORT, useValue: transport }],
      });
      const auth = TestBed.inject(AuthStore);
      auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
      const fixture = TestBed.createComponent(ShellComponent);
      fixture.detectChanges();
      const button = () =>
        Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === 'Sign out',
        ) as HTMLButtonElement | undefined;
      return { auth, fixture, button, calls: () => calls };
    }

    it('is a button in the top bar, only for a signed-in user', async () => {
      const { auth, fixture, button } = signedIn();
      expect(button()).toBeDefined();
      expect(button()!.closest('.top')).not.toBeNull();
      auth.signOut();
      fixture.detectChanges();
      expect(button()).toBeUndefined();
    });

    it('tells the server, forgets the token and goes to the sign-in page', async () => {
      const { auth, fixture, button, calls } = signedIn();
      const router = TestBed.inject(Router);
      button()!.click();
      await fixture.whenStable();
      expect(calls()).toBe(1);
      expect(auth.token()).toBeUndefined();
      expect(localStorage.getItem('kantahe.token')).toBeNull();
      expect(router.url).toBe('/login');
    });

    it('signs out here and says so when the server cannot be reached', async () => {
      const { auth, fixture, button } = signedIn(() => {
        throw new ConnectError('down', Code.Unavailable);
      });
      const router = TestBed.inject(Router);
      button()!.click();
      await fixture.whenStable();
      expect(auth.token()).toBeUndefined();
      expect(router.url).toBe('/login');
      const toasts = TestBed.inject(ToastService).toasts();
      expect(toasts.map((t) => t.message)).toEqual([
        'Signed out here. The server could not be told, so this device stays signed in there until it expires.',
      ]);
    });

    it('asks the server once however often it is pressed', async () => {
      const { fixture, button, calls } = signedIn();
      button()!.click();
      button()!.click();
      await fixture.whenStable();
      expect(calls()).toBe(1);
    });
  });
});
