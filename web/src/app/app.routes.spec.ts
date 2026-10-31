import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { create } from '@bufbuild/protobuf';
import { createRouterTransport } from '@connectrpc/connect';
import { AuthService, GetServerInfoResponseSchema, MeResponseSchema } from '../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, UserSchema } from '../gen/kantahe/v1/common_pb';
import { TRANSPORT } from './core/api';
import { AuthStore } from './core/auth.store';
import { routes } from './app.routes';
import { PageTitleStrategy } from './core/page-title';

function setup(opts: { setupRequired?: boolean; admin?: boolean } = {}) {
  localStorage.clear();
  const transport = createRouterTransport(({ service }) =>
    service(AuthService, {
      getServerInfo: () => create(GetServerInfoResponseSchema, { setupRequired: opts.setupRequired ?? false }),
      me: () => create(MeResponseSchema, { user: create(UserSchema, { admin: opts.admin ?? false }) }),
    }),
  );
  TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: TitleStrategy, useClass: PageTitleStrategy }, { provide: TRANSPORT, useValue: transport }] });
  return RouterTestingHarness.create();
}

function signIn(admin = false, uploader = false) {
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { admin, uploader }) }));
}

describe('routes', () => {
  it('the root goes to the library, which needs a sign-in', async () => {
    const h = await setup();
    await h.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Flibrary');
  });

  it('a signed-in user reaches the library and the password page', async () => {
    const h = await setup();
    signIn();
    await h.navigateByUrl('/library');
    expect(TestBed.inject(Router).url).toBe('/library');
    await h.navigateByUrl('/me/password');
    expect(TestBed.inject(Router).url).toBe('/me/password');
  });

  it('/me needs a sign-in and opens on the favourites', async () => {
    const h = await setup();
    await h.navigateByUrl('/me');
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fme%2Ffavourites');
    signIn();
    await h.navigateByUrl('/me');
    expect(TestBed.inject(Router).url).toBe('/me/favourites');
  });

  it('the TV approval page needs a sign-in', async () => {
    const h = await setup();
    await h.navigateByUrl('/code');
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fcode');
    signIn();
    await h.navigateByUrl('/code');
    expect(TestBed.inject(Router).url).toBe('/code');
  });

  it('the admin area is for admins only', async () => {
    const h = await setup();
    signIn(false);
    await h.navigateByUrl('/admin');
    expect(TestBed.inject(Router).url).toBe('/library');
  });

  it('an uploader who is not an administrator reaches /upload but not the song administration', async () => {
    const h = await setup();
    signIn(false, true);
    await h.navigateByUrl('/upload');
    expect(TestBed.inject(Router).url).toBe('/upload');
    await h.navigateByUrl('/admin/songs');
    expect(TestBed.inject(Router).url).toBe('/library');
    await h.navigateByUrl('/admin/settings');
    expect(TestBed.inject(Router).url).toBe('/library');
  });

  it('somebody without the uploader role cannot open /upload', async () => {
    const h = await setup();
    signIn(false, false);
    await h.navigateByUrl('/upload');
    expect(TestBed.inject(Router).url).toBe('/library');
  });

  it('an administrator reaches the song pages and the settings', async () => {
    const h = await setup({ admin: true });
    signIn(true);
    await h.navigateByUrl('/admin/songs');
    expect(TestBed.inject(Router).url).toBe('/admin/songs');
    await h.navigateByUrl('/admin/settings');
    expect(TestBed.inject(Router).url).toBe('/admin/settings');
    await h.navigateByUrl('/upload');
    expect(TestBed.inject(Router).url).toBe('/upload');
  });

  it('an admin reaches the admin area', async () => {
    const h = await setup({ admin: true });
    signIn(true);
    await h.navigateByUrl('/admin');
    expect(TestBed.inject(Router).url).toBe('/admin/users');
  });

  it('while no admin exists everyone is sent to /setup', async () => {
    const h = await setup({ setupRequired: true });
    await h.navigateByUrl('/login');
    expect(TestBed.inject(Router).url).toBe('/setup');
  });

  it('login and setup are open once setup is done', async () => {
    const h = await setup();
    await h.navigateByUrl('/login');
    expect(TestBed.inject(Router).url).toBe('/login');
    await h.navigateByUrl('/setup');
    expect(TestBed.inject(Router).url).toBe('/setup');
  });

  it('an unknown address goes to the library', async () => {
    const h = await setup();
    signIn();
    await h.navigateByUrl('/nowhere/at/all');
    expect(TestBed.inject(Router).url).toBe('/library');
  });

  describe('page titles', () => {
    const titleAfter = async (h: Awaited<ReturnType<typeof setup>>, url: string) => {
      await h.navigateByUrl(url);
      return document.title;
    };

    it('regression: every page has its own title instead of "Kantahe" everywhere', async () => {
      const h = await setup({ admin: true });
      signIn(true);
      expect(await titleAfter(h, '/library')).toBe('Library · Kantahe');
      expect(await titleAfter(h, '/queue')).toBe('Queue · Kantahe');
      expect(await titleAfter(h, '/me/favourites')).toBe('Favourites · Kantahe');
      expect(await titleAfter(h, '/me/devices')).toBe('Devices · Kantahe');
      expect(await titleAfter(h, '/code')).toBe('Approve a TV · Kantahe');
      expect(await titleAfter(h, '/upload')).toBe('Upload songs · Kantahe');
      expect(await titleAfter(h, '/admin/users')).toBe('Users · Kantahe');
      expect(await titleAfter(h, '/admin/songs')).toBe('Songs · Kantahe');
      expect(await titleAfter(h, '/admin/settings')).toBe('Settings · Kantahe');
      expect(await titleAfter(h, '/player')).toBe('Player · Kantahe');
    });

    it('the sign-in and set-up pages have titles too', async () => {
      const h = await setup();
      expect(await titleAfter(h, '/login')).toBe('Sign in · Kantahe');
      expect(await titleAfter(h, '/setup')).toBe('Set up · Kantahe');
    });
  });
});
