import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { AuthService, LogoutResponseSchema } from '../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, UserSchema } from '../gen/kantahe/v1/common_pb';
import { TRANSPORT } from './core/api';
import { AuthStore } from './core/auth.store';
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
    expect(el.querySelector('h1')?.textContent).toBe('Kantahe');
    expect(el.querySelector('router-outlet')).not.toBeNull();
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
      ['Approve a TV', '/code'],
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

  it('shows Upload to uploaders and administrators only', async () => {
    const auth = TestBed.inject(AuthStore);
    const fixture = TestBed.createComponent(ShellComponent);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, {}) }));
    await fixture.whenStable();
    const hrefs = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map((a) => a.getAttribute('href'));
    expect(hrefs()).not.toContain('/upload');
    auth.setUser(create(UserSchema, { uploader: true }));
    await fixture.whenStable();
    expect(hrefs()).toContain('/upload');
    auth.setUser(create(UserSchema, { admin: true }));
    await fixture.whenStable();
    expect(hrefs()).toContain('/upload');
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
        Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav button')).find(
          (b) => b.textContent?.trim() === 'Sign out',
        ) as HTMLButtonElement | undefined;
      return { auth, fixture, button, calls: () => calls };
    }

    it('is a button at the end of the menu, only for a signed-in user', async () => {
      const { auth, fixture, button } = signedIn();
      expect(button()).toBeDefined();
      expect(button()!.parentElement!.lastElementChild).toBe(button());
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
