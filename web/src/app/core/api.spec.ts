import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Code, ConnectError, createClient, createRouterTransport } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { AuthService, MeResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { SessionService, StateSchema } from '../../gen/kantahe/v1/session_pb';
import { apiInterceptors, TRANSPORT, injectClient } from './api';
import { AuthStore } from './auth.store';
import { ServerUrl } from './server-url';

function handlers(token: string | undefined) {
  const calls = { unauthenticated: 0, passwordChange: 0 };
  const interceptors = apiInterceptors({
    token: () => token,
    onUnauthenticated: () => calls.unauthenticated++,
    onPasswordChange: () => calls.passwordChange++,
  });
  return { calls, interceptors };
}

describe('apiInterceptors', () => {
  it('sends the bearer token', async () => {
    const seen: (string | null)[] = [];
    const { interceptors } = handlers('t1');
    const transport = createRouterTransport(
      ({ service }) =>
        service(AuthService, {
          me: (_req, ctx) => {
            seen.push(ctx.requestHeader.get('authorization'));
            return create(MeResponseSchema, { user: create(UserSchema, { email: 'a@example.com' }) });
          },
        }),
      { transport: { interceptors } },
    );
    const res = await createClient(AuthService, transport).me({});
    expect(res.user?.email).toBe('a@example.com');
    expect(seen).toEqual(['Bearer t1']);
  });

  it('sends no header without a token', async () => {
    const seen: (string | null)[] = [];
    const { interceptors } = handlers(undefined);
    const transport = createRouterTransport(
      ({ service }) =>
        service(AuthService, {
          me: (_req, ctx) => {
            seen.push(ctx.requestHeader.get('authorization'));
            return create(MeResponseSchema, {});
          },
        }),
      { transport: { interceptors } },
    );
    await createClient(AuthService, transport).me({});
    expect(seen).toEqual([null]);
  });

  function failing(code: Code, message: string, token: string | undefined) {
    const h = handlers(token);
    const transport = createRouterTransport(
      ({ service }) =>
        service(AuthService, {
          me: () => {
            throw new ConnectError(message, code);
          },
        }),
      { transport: { interceptors: h.interceptors } },
    );
    return { h, client: createClient(AuthService, transport) };
  }

  it('reports Unauthenticated when a token was sent, and still throws', async () => {
    const { h, client } = failing(Code.Unauthenticated, 'sign in required', 't');
    await expect(client.me({})).rejects.toMatchObject({ code: Code.Unauthenticated });
    expect(h.calls).toEqual({ unauthenticated: 1, passwordChange: 0 });
  });

  it('does not treat a failed sign-in (no token sent) as an expired session', async () => {
    const { h, client } = failing(Code.Unauthenticated, 'invalid email or password', undefined);
    await expect(client.me({})).rejects.toMatchObject({ code: Code.Unauthenticated });
    expect(h.calls.unauthenticated).toBe(0);
  });

  it('reports a required password change', async () => {
    const { h, client } = failing(Code.FailedPrecondition, 'password change required', 't');
    await expect(client.me({})).rejects.toMatchObject({ code: Code.FailedPrecondition });
    expect(h.calls).toEqual({ unauthenticated: 0, passwordChange: 1 });
  });

  it('ignores other failed preconditions and other errors', async () => {
    for (const [code, msg] of [
      [Code.FailedPrecondition, 'setup is already complete'],
      [Code.NotFound, 'password change required'],
      [Code.Unavailable, 'down'],
    ] as const) {
      const { h, client } = failing(code, msg, 't');
      await expect(client.me({})).rejects.toBeInstanceOf(ConnectError);
      expect(h.calls).toEqual({ unauthenticated: 0, passwordChange: 0 });
    }
  });

  it('passes stream messages through and reports a stream that fails with Unauthenticated', async () => {
    const h = handlers('t');
    const transport = createRouterTransport(
      ({ service }) =>
        service(SessionService, {
          async *watchState() {
            yield { state: create(StateSchema, { playerDeviceId: 'd1' }) };
            throw new ConnectError('sign in required', Code.Unauthenticated);
          },
        }),
      { transport: { interceptors: h.interceptors } },
    );
    const got: string[] = [];
    const run = async () => {
      for await (const m of createClient(SessionService, transport).watchState({})) {
        got.push(m.state?.playerDeviceId ?? '');
      }
    };
    await expect(run()).rejects.toMatchObject({ code: Code.Unauthenticated });
    expect(got).toEqual(['d1']);
    expect(h.calls.unauthenticated).toBe(1);
  });
});

describe('TRANSPORT and injectClient', () => {
  const fetchMock = vi.fn();

  function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('calls the configured server with JSON and the bearer token', async () => {
    TestBed.inject(ServerUrl).set('https://k.example/sing');
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 'secret', deviceId: 'd' }));
    fetchMock.mockResolvedValue(json(200, { user: { email: 'a@example.com' } }));
    const client = TestBed.runInInjectionContext(() => injectClient(AuthService));
    const res = await client.me({});
    expect(res.user?.email).toBe('a@example.com');
    const [url, init] = fetchMock.mock.calls[0] as [string | Request, RequestInit | undefined];
    const req = url instanceof Request ? url : new Request(url, init);
    expect(req.url).toBe('https://k.example/sing/kantahe.v1.AuthService/Me');
    expect(req.headers.get('authorization')).toBe('Bearer secret');
    expect(req.headers.get('content-type')).toContain('application/json');
    expect(req.url).not.toContain('secret');
  });

  it('signs out and goes to /login when the server says Unauthenticated', async () => {
    const auth = TestBed.inject(AuthStore);
    auth.signIn(create(AuthTokenSchema, { token: 'old', deviceId: 'd' }));
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fetchMock.mockResolvedValue(json(401, { code: 'unauthenticated', message: 'sign in required' }));
    const client = TestBed.runInInjectionContext(() => injectClient(AuthService));
    await expect(client.me({})).rejects.toMatchObject({ code: Code.Unauthenticated });
    expect(auth.token()).toBeUndefined();
    expect(localStorage.getItem('kantahe.token')).toBeNull();
    expect(nav).toHaveBeenCalledWith('/login');
  });

  it('goes to /me/password when a password change is required', async () => {
    const auth = TestBed.inject(AuthStore);
    auth.signIn(create(AuthTokenSchema, { token: 'tmp', deviceId: 'd', user: create(UserSchema, { email: 'a@example.com' }) }));
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fetchMock.mockResolvedValue(json(400, { code: 'failed_precondition', message: 'password change required' }));
    const client = TestBed.runInInjectionContext(() => injectClient(AuthService));
    await expect(client.me({})).rejects.toMatchObject({ code: Code.FailedPrecondition });
    expect(nav).toHaveBeenCalledWith('/me/password');
    expect(auth.token()).toBe('tmp');
    expect(auth.user()?.mustChangePassword).toBe(true);
  });

  it('regression: a server address set after the first call is used by the next call', async () => {
    const client = TestBed.runInInjectionContext(() => injectClient(AuthService));
    fetchMock.mockImplementation(() => Promise.resolve(json(200, { user: { email: 'a@example.com' } })));
    await client.me({});
    TestBed.inject(ServerUrl).set('https://tv.example');
    await client.me({});
    const urls = fetchMock.mock.calls.map(([u, init]) => (u instanceof Request ? u : new Request(u as string, init as RequestInit)).url);
    expect(urls).toEqual([`${window.location.origin}/kantahe.v1.AuthService/Me`, 'https://tv.example/kantahe.v1.AuthService/Me']);
  });

  it('uses the same transport for every client', () => {
    expect(TestBed.inject(TRANSPORT)).toBe(TestBed.inject(TRANSPORT));
  });
});
