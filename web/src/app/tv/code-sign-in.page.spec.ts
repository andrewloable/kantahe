import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import {
  AuthService,
  StartCodeLoginRequest,
  StartCodeLoginResponseSchema,
  WaitCodeLoginResponse,
  WaitCodeLoginResponseSchema,
} from '../../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, DeviceType, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { Environment } from '../../environments/environment.model';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { ENVIRONMENT } from '../core/environment';
import { ServerUrl } from '../core/server-url';
import { alerts, text } from '../testing';
import { CodeSignInPage } from './code-sign-in.page';
import { qrMatrix, qrPath } from './qr';

const TIZEN: Environment = { isTv: true, tvDeviceType: DeviceType.TIZEN };
const WEBOS: Environment = { isTv: true, tvDeviceType: DeviceType.WEBOS };

/** A stream the test feeds by hand; it ends when the client goes away. */
class Channel {
  aborted = false;
  private queue: ({ msg: WaitCodeLoginResponse } | { end: true } | { err: unknown })[] = [];
  private wake?: () => void;
  push(msg: WaitCodeLoginResponse) {
    this.queue.push({ msg });
    this.wake?.();
  }
  end() {
    this.queue.push({ end: true });
    this.wake?.();
  }
  async *iterate(signal: AbortSignal): AsyncGenerator<WaitCodeLoginResponse> {
    signal.addEventListener('abort', () => {
      this.aborted = true;
      this.wake?.();
    });
    for (;;) {
      while (this.queue.length === 0) {
        await new Promise<void>((r) => (this.wake = r));
        if (this.aborted) return;
      }
      const item = this.queue.shift()!;
      if ('end' in item) return;
      if ('err' in item) throw item.err;
      yield item.msg;
    }
  }
}

interface Options {
  env?: Environment;
  approveUrl?: string;
  failStart?: () => boolean;
  query?: Record<string, string>;
}

function setup(o: Options = {}) {
  localStorage.clear();
  const starts: StartCodeLoginRequest[] = [];
  const waits: string[] = [];
  const channels: Channel[] = [];
  const failures: unknown[] = []; // thrown by the next waits, in turn
  let started = 0;
  const transport = createRouterTransport(({ service }) =>
    service(AuthService, {
      startCodeLogin(req) {
        starts.push(req);
        if (o.failStart?.()) throw new ConnectError('down', Code.Unavailable);
        started++;
        return create(StartCodeLoginResponseSchema, {
          loginId: `login-${started}`,
          code: `ABCD2${started}`,
          expiresAtUnix: BigInt(Math.floor(Date.now() / 1000) + 300),
          approveUrl: o.approveUrl ?? 'http://srv:1/code',
        });
      },
      async *waitCodeLogin(req, ctx) {
        waits.push(req.loginId);
        const failure = failures.shift();
        if (failure) throw failure;
        const c = new Channel();
        channels.push(c);
        yield* c.iterate(ctx.signal);
      },
    }),
  );
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: TRANSPORT, useValue: transport },
      { provide: ENVIRONMENT, useValue: o.env ?? TIZEN },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(o.query ?? {}) } } },
    ],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(CodeSignInPage);
  document.body.appendChild(fixture.nativeElement); // focus needs the page to be in the document
  fixture.detectChanges();
  const settle = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let i = 0; i < 6; i++) {
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(0);
    }
    fixture.detectChanges();
  };
  const el = fixture.nativeElement as HTMLElement;
  const button = (label: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined;
  return { fixture, el, starts, waits, channels, failures, nav, settle, button };
}

const approved = (token = 'tv-token') =>
  create(WaitCodeLoginResponseSchema, {
    result: { case: 'approved', value: create(AuthTokenSchema, { token, deviceId: 'tv-1', user: create(UserSchema, { email: 'a@example.com' }) }) },
  });
const expired = () => create(WaitCodeLoginResponseSchema, { result: { case: 'expired', value: true } });

describe('CodeSignInPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('asks for a code for this TV and shows it large, with the QR of the approval address', async () => {
    const { starts, el, settle } = setup();
    await settle();
    expect(starts.length).toBe(1);
    expect(starts[0].deviceName).toBe('Samsung TV');
    expect(starts[0].deviceType).toBe(DeviceType.TIZEN);
    const code = el.querySelector('#login-code') as HTMLElement;
    expect(code.textContent?.trim()).toBe('ABCD21');
    const path = el.querySelector('svg[role="img"] path') as SVGPathElement;
    expect(path.getAttribute('d')).toBe(qrPath(qrMatrix('http://srv:1/code')));
    expect(el.textContent).toContain('http://srv:1/code');
    expect(el.textContent).toContain('Approve');
  });

  it('a webOS build is an LG TV of type WEBOS', async () => {
    const { starts, settle } = setup({ env: WEBOS });
    await settle();
    expect(starts[0].deviceName).toBe('LG TV');
    expect(starts[0].deviceType).toBe(DeviceType.WEBOS);
  });

  it('keeps WaitCodeLogin open with the secret of this login', async () => {
    const { waits, settle } = setup();
    await settle();
    expect(waits).toEqual(['login-1']);
  });

  it('shows no QR when the server has no public address to put in it, but still the code', async () => {
    const { el, settle } = setup({ approveUrl: '' });
    await settle();
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('#login-code')?.textContent?.trim()).toBe('ABCD21');
  });

  it('approved: signs the TV in with the token and opens the library', async () => {
    const { channels, nav, settle } = setup();
    await settle();
    channels[0].push(approved());
    await settle();
    const auth = TestBed.inject(AuthStore);
    expect(auth.token()).toBe('tv-token');
    expect(auth.deviceId()).toBe('tv-1');
    expect(nav).toHaveBeenCalledWith('/library', { replaceUrl: true });
  });

  it('approved: goes back to the page that was asked for, when it is one of ours', async () => {
    const { channels, nav, settle } = setup({ query: { returnUrl: '/queue' } });
    await settle();
    channels[0].push(approved());
    await settle();
    expect(nav).toHaveBeenCalledWith('/queue', { replaceUrl: true });
  });

  it('regression: approved leaves the code screen out of the history, so that Back from the library does not open a new code', async () => {
    const { channels, nav, settle } = setup();
    await settle();
    channels[0].push(approved());
    await settle();
    expect(nav.mock.calls[0][1]).toEqual({ replaceUrl: true });
  });

  it('approved: never goes to another site', async () => {
    const { channels, nav, settle } = setup({ query: { returnUrl: '//evil.example' } });
    await settle();
    channels[0].push(approved());
    await settle();
    expect(nav).toHaveBeenCalledWith('/library', { replaceUrl: true });
  });

  it('expired: says so and offers a new code, which starts a new login', async () => {
    const { channels, el, button, settle, waits, starts } = setup();
    await settle();
    channels[0].push(expired());
    await settle();
    expect(text({ nativeElement: el } as never)).toContain('Code expired');
    expect(el.querySelector('#login-code')).toBeNull();
    button('New code')!.click();
    await settle();
    expect(starts.length).toBe(2);
    expect(el.querySelector('#login-code')?.textContent?.trim()).toBe('ABCD22');
    expect(waits).toEqual(['login-1', 'login-2']);
    expect(el.textContent).not.toContain('Code expired');
  });

  it('the New code button has the focus, so that OK on the remote presses it', async () => {
    const { channels, button, settle } = setup();
    await settle();
    channels[0].push(expired());
    await settle();
    expect(document.activeElement).toBe(button('New code'));
  });

  it('a wait that drops while the code is valid is opened again with the same secret', async () => {
    const { failures, waits, channels, settle } = setup();
    failures.push(new ConnectError('down', Code.Unavailable));
    await settle();
    expect(waits).toEqual(['login-1']);
    await settle(1000);
    expect(waits).toEqual(['login-1', 'login-1']);
    channels[0].push(approved());
    await settle();
    expect(TestBed.inject(AuthStore).signedIn()).toBe(true);
  });

  it('a stream that ends without an answer is also opened again', async () => {
    const { channels, waits, settle } = setup();
    await settle();
    channels[0].end();
    await settle(1000);
    expect(waits.length).toBe(2);
  });

  it('regression: a login the server no longer knows is an expired code, not a wait to repeat for ever', async () => {
    const { failures, el, waits, button, settle } = setup();
    failures.push(new ConnectError('unknown or used sign-in', Code.NotFound));
    await settle(15000);
    expect(el.textContent).toContain('Code expired');
    expect(button('New code')).toBeDefined();
    expect(waits).toEqual(['login-1']);
  });

  it('regression: a refused account is told so, not waited on for ever', async () => {
    const { failures, el, waits, button, settle } = setup();
    failures.push(new ConnectError('account disabled', Code.PermissionDenied));
    await settle(15000);
    expect(alerts({ nativeElement: el } as never).join(' ')).toContain('account disabled');
    expect(button('Try again')).toBeDefined();
    expect(waits).toEqual(['login-1']);
  });

  it('a code the server could not give shows why, with a way to try again', async () => {
    let fail = true;
    const { el, button, settle, starts } = setup({ failStart: () => fail });
    await settle();
    expect(alerts({ nativeElement: el } as never).join(' ')).toContain('Could not reach the server');
    expect(el.querySelector('svg')).toBeNull();
    fail = false;
    button('Try again')!.click();
    await settle();
    expect(starts.length).toBe(2);
    expect(el.querySelector('#login-code')?.textContent?.trim()).toBe('ABCD21');
  });

  it('leaving the page ends the wait, and an answer that comes later is not used', async () => {
    const { fixture, channels, settle } = setup();
    await settle();
    fixture.destroy();
    await settle();
    expect(channels[0].aborted).toBe(true);
    channels[0].push(approved('late'));
    await settle();
    expect(TestBed.inject(AuthStore).signedIn()).toBe(false);
  });

  it('an answer that is already on its way when the page is left is not used either', async () => {
    const { fixture, channels, settle } = setup();
    await settle();
    channels[0].push(approved('in flight'));
    fixture.destroy();
    await settle();
    expect(TestBed.inject(AuthStore).signedIn()).toBe(false);
  });

  it('"Use another server" forgets the address and the session and goes to the address page', async () => {
    const { button, settle, nav } = setup();
    TestBed.inject(ServerUrl).set('http://srv:1');
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 'old', deviceId: 'd', user: create(UserSchema, {}) }));
    await settle();
    button('Use another server')!.click();
    await settle();
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false); // the TV environment has no origin to fall back to
    expect(TestBed.inject(AuthStore).signedIn()).toBe(false);
    expect(nav).toHaveBeenCalledWith('/server');
  });
});
