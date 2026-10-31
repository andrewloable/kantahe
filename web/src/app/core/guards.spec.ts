import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { AuthService, GetServerInfoResponseSchema, MeResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from './api';
import { AuthStore } from './auth.store';
import { adminGuard, authGuard, setupGuard, uploaderGuard } from './guards';

interface Server {
  me?: () => unknown;
  info?: () => unknown;
  meCalls: number;
}

function setup(server: Partial<Server> = {}) {
  const s: Server = { meCalls: 0, ...server };
  const transport = createRouterTransport(({ service }) =>
    service(AuthService, {
      me() {
        s.meCalls++;
        return (s.me ?? (() => create(MeResponseSchema, { user: create(UserSchema, { email: 'a@example.com' }) })))() as never;
      },
      getServerInfo() {
        return (s.info ?? (() => create(GetServerInfoResponseSchema, { setupRequired: false })))() as never;
      },
    }),
  );
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: transport }] });
  return s;
}

const route = {} as ActivatedRouteSnapshot;
const state = { url: '/library' } as RouterStateSnapshot;

function run(guard: typeof authGuard) {
  return TestBed.runInInjectionContext(() => guard(route, state)) as Promise<boolean | UrlTree> | boolean | UrlTree;
}

function url(r: boolean | UrlTree): string {
  expect(r instanceof UrlTree).toBe(true);
  return (r as UrlTree).toString();
}

function signIn(admin: boolean, withUser = true) {
  TestBed.inject(AuthStore).signIn(
    create(AuthTokenSchema, { token: 't', deviceId: 'd', user: withUser ? create(UserSchema, { email: 'a@example.com', admin }) : undefined }),
  );
}

describe('authGuard', () => {
  it('sends a visitor without a token to /login and remembers where they wanted to go', async () => {
    const s = setup();
    expect(url(await run(authGuard))).toBe('/login?returnUrl=%2Flibrary');
    expect(s.meCalls).toBe(0);
  });

  it('lets a signed-in user through without asking the server again', async () => {
    const s = setup();
    signIn(false);
    expect(await run(authGuard)).toBe(true);
    expect(s.meCalls).toBe(0);
  });

  it('loads the user after a page reload', async () => {
    const s = setup();
    signIn(false, false);
    expect(await run(authGuard)).toBe(true);
    expect(s.meCalls).toBe(1);
    expect(TestBed.inject(AuthStore).user()?.email).toBe('a@example.com');
  });

  it('sends a user whose token the server refuses to /login', async () => {
    setup({
      me: () => {
        throw new ConnectError('sign in required', Code.Unauthenticated);
      },
    });
    signIn(false, false);
    expect(url(await run(authGuard))).toBe('/login?returnUrl=%2Flibrary');
  });

  it('lets the user in when the server cannot be reached', async () => {
    setup({
      me: () => {
        throw new ConnectError('down', Code.Unavailable);
      },
    });
    signIn(false, false);
    expect(await run(authGuard)).toBe(true);
  });
});

describe('authGuard and a required password change', () => {
  const at = (url: string) => ({ url }) as RouterStateSnapshot;
  const runAt = (url: string) => TestBed.runInInjectionContext(() => authGuard(route, at(url))) as Promise<boolean | UrlTree>;

  it('regression: sends a user who must change the password to the change-password page, whatever they asked for', async () => {
    setup();
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { email: 'a@example.com', mustChangePassword: true }) }));
    expect(url(await runAt('/library'))).toBe('/me/password');
    expect(url(await runAt('/code'))).toBe('/me/password');
  });

  it('lets them reach the change-password page itself', async () => {
    setup();
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { mustChangePassword: true }) }));
    expect(await runAt('/me/password')).toBe(true);
    expect(await runAt('/me/password?x=1')).toBe(true);
  });

  it('notices the requirement when the user is loaded after a page reload', async () => {
    setup({ me: () => create(MeResponseSchema, { user: create(UserSchema, { mustChangePassword: true }) }) });
    signIn(false, false);
    expect(url(await runAt('/library'))).toBe('/me/password');
  });

  it('does not bother a user without the requirement', async () => {
    setup();
    signIn(false);
    expect(await runAt('/library')).toBe(true);
  });
});

describe('adminGuard', () => {
  it('lets an admin through', async () => {
    setup();
    signIn(true);
    expect(await run(adminGuard)).toBe(true);
  });

  it('sends a non-admin to /library', async () => {
    setup();
    signIn(false);
    expect(url(await run(adminGuard))).toBe('/library');
  });

  it('asks the server when the user is not loaded yet', async () => {
    const s = setup({ me: () => create(MeResponseSchema, { user: create(UserSchema, { admin: true }) }) });
    signIn(false, false);
    expect(await run(adminGuard)).toBe(true);
    expect(s.meCalls).toBe(1);
  });

  it('sends the user to /library when the server cannot say', async () => {
    setup({
      me: () => {
        throw new ConnectError('down', Code.Unavailable);
      },
    });
    signIn(false, false);
    expect(url(await run(adminGuard))).toBe('/library');
  });

  it('sends a visitor without a token to /login', async () => {
    setup();
    expect(url(await run(adminGuard))).toBe('/login?returnUrl=%2Flibrary');
  });
});

describe('setupGuard', () => {
  it('sends everybody to /setup while no admin exists', async () => {
    setup({ info: () => create(GetServerInfoResponseSchema, { setupRequired: true }) });
    expect(url(await run(setupGuard))).toBe('/setup');
  });

  it('lets the visitor through once setup is done', async () => {
    setup();
    expect(await run(setupGuard)).toBe(true);
  });

  it('lets the visitor through when the server cannot be asked (the page shows the error)', async () => {
    setup({
      info: () => {
        throw new ConnectError('down', Code.Unavailable);
      },
    });
    expect(await run(setupGuard)).toBe(true);
  });
});

describe('uploaderGuard', () => {
  const runUp = () => TestBed.runInInjectionContext(() => uploaderGuard(route, state)) as Promise<boolean | UrlTree>;
  const signInAs = (uploader: boolean, admin: boolean) =>
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { uploader, admin }) }));

  it('lets an uploader through', async () => {
    setup();
    signInAs(true, false);
    expect(await runUp()).toBe(true);
  });

  it('lets an administrator through even without the uploader role', async () => {
    setup();
    signInAs(false, true);
    expect(await runUp()).toBe(true);
  });

  it('sends anybody else to the library', async () => {
    setup();
    signInAs(false, false);
    expect(url(await runUp())).toBe('/library');
  });

  it('sends a visitor to the sign-in page', async () => {
    setup();
    expect(url(await runUp())).toBe('/login?returnUrl=%2Flibrary');
  });

  it('loads the user after a reload before deciding', async () => {
    const s = setup({ me: () => create(MeResponseSchema, { user: create(UserSchema, { uploader: true }) }) });
    signIn(false, false);
    expect(await runUp()).toBe(true);
    expect(s.meCalls).toBe(1);
  });
});
