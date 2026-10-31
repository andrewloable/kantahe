import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { create } from '@bufbuild/protobuf';
import { createRouterTransport } from '@connectrpc/connect';
import { AuthService, GetServerInfoResponseSchema, StartCodeLoginResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, DeviceType, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { Environment } from '../../environments/environment.model';
import { buildRoutes } from '../app.routes';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { ENVIRONMENT } from '../core/environment';
import { ServerUrl } from '../core/server-url';
import { ServerAddressPage } from './server-address.page';

const TV: Environment = { isTv: true, tvDeviceType: DeviceType.TIZEN };
const WEB: Environment = { isTv: false, tvDeviceType: DeviceType.UNSPECIFIED };

function setup(env: Environment, address?: string) {
  localStorage.clear();
  const transport = createRouterTransport(({ service }) =>
    service(AuthService, {
      getServerInfo: () => create(GetServerInfoResponseSchema, { setupRequired: false }),
      startCodeLogin: () => create(StartCodeLoginResponseSchema, { loginId: 'l', code: 'ABCDE2', approveUrl: '' }),
      // eslint-disable-next-line require-yield -- a wait that never answers
      async *waitCodeLogin(_req, ctx) {
        await new Promise<void>((r) => ctx.signal.addEventListener('abort', () => r()));
      },
    }),
  );
  TestBed.configureTestingModule({
    providers: [provideRouter(buildRoutes(env)), { provide: TRANSPORT, useValue: transport }, { provide: ENVIRONMENT, useValue: env }],
  });
  if (address) TestBed.inject(ServerUrl).set(address);
  return RouterTestingHarness.create();
}

const url = () => TestBed.inject(Router).url;

describe('routes of a TV build', () => {
  it('with no server address every page goes to the address page first', async () => {
    const h = await setup(TV);
    await h.navigateByUrl('/library');
    expect(url()).toBe('/server?returnUrl=%2Flibrary');
    await h.navigateByUrl('/queue');
    expect(url()).toBe('/server?returnUrl=%2Fqueue');
  });

  it('the address page itself is reachable and is the address page', async () => {
    const h = await setup(TV);
    const page = await h.navigateByUrl('/server', ServerAddressPage);
    expect(page).toBeInstanceOf(ServerAddressPage);
    expect(url()).toBe('/server');
  });

  it('the player screen needs the address too', async () => {
    const h = await setup(TV);
    await h.navigateByUrl('/player');
    expect(url()).toBe('/server?returnUrl=%2Fplayer');
  });

  it('with an address and no session the sign-in is the code screen, not the password form', async () => {
    const h = await setup(TV, 'http://192.168.1.20:8080');
    await h.navigateByUrl('/library');
    expect(url()).toBe('/login?returnUrl=%2Flibrary');
    await h.navigateByUrl('/login');
    expect(h.routeNativeElement?.querySelector('app-code-sign-in-page')).not.toBeNull();
    expect(h.routeNativeElement?.querySelector('app-login-page')).toBeNull();
  });

  it('with an address and a session the library opens', async () => {
    const h = await setup(TV, 'http://192.168.1.20:8080');
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, {}) }));
    await h.navigateByUrl('/library');
    expect(url()).toBe('/library');
  });
});

describe('routes of the web build', () => {
  it('the sign-in is the password form and there is no address page', async () => {
    const h = await setup(WEB);
    await h.navigateByUrl('/login');
    expect(h.routeNativeElement?.querySelector('app-login-page')).not.toBeNull();
    expect(h.routeNativeElement?.querySelector('app-code-sign-in-page')).toBeNull();
    await h.navigateByUrl('/server');
    expect(url()).not.toContain('/server');
  });

  it('pages need no address: the page origin is the server', async () => {
    const h = await setup(WEB);
    await h.navigateByUrl('/library');
    expect(url()).toBe('/login?returnUrl=%2Flibrary');
  });
});
