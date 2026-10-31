import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { AuthService, GetServerInfoResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, DeviceType, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { Environment } from '../../environments/environment.model';
import { AuthStore } from '../core/auth.store';
import { ENVIRONMENT } from '../core/environment';
import { ServerUrl } from '../core/server-url';
import { alerts, text } from '../testing';
import { SERVER_PROBE, ServerAddressPage } from './server-address.page';

const TV: Environment = { isTv: true, tvDeviceType: DeviceType.TIZEN };

@Component({ template: '' })
class Blank {}

function setup(info: () => unknown = () => create(GetServerInfoResponseSchema, { version: '1.0', setupRequired: false })) {
  localStorage.clear();
  const probed: string[] = [];
  let calls = 0;
  const transport = createRouterTransport(({ service }) =>
    service(AuthService, {
      getServerInfo: async () => {
        calls++;
        return info() as never;
      },
    }),
  );
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'login', component: Blank }]),
      { provide: ENVIRONMENT, useValue: TV },
      {
        provide: SERVER_PROBE,
        useValue: (base: string) => {
          probed.push(base);
          return transport;
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ServerAddressPage);
  document.body.appendChild(fixture.nativeElement); // focus needs the page to be in the document
  fixture.detectChanges();
  const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  return { fixture, probed, nav, calls: () => calls };
}

// fake timers: the helpers of ../testing wait for the fixture to be stable, which waits for a timer that never runs
const settle = async (fixture: { detectChanges(): void }, ms = 0) => {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 6; i++) await vi.advanceTimersByTimeAsync(0);
  fixture.detectChanges();
};

const fill = async (fixture: { nativeElement: HTMLElement; detectChanges(): void }, selector: string, value: string) => {
  const el = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await settle(fixture);
};

const submit = async (fixture: { nativeElement: HTMLElement; detectChanges(): void }) => {
  (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await settle(fixture);
};

describe('ServerAddressPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('asks for the address in a labelled field that starts with http://', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('#server') as HTMLInputElement;
    expect(el.querySelector('label[for="server"]')).not.toBeNull();
    expect(input.value).toBe('http://');
    expect(el.querySelector('button[type="submit"]')?.textContent).toContain('Connect');
  });

  it('the remote starts in the address field: the first thing to do here is to type', () => {
    const { fixture } = setup();
    expect(document.activeElement).toBe((fixture.nativeElement as HTMLElement).querySelector('#server'));
  });

  it('checks the address with GetServerInfo, stores it and goes on to sign-in', async () => {
    const { fixture, probed, nav } = setup();
    await fill(fixture, '#server', '192.168.1.20:8080');
    await submit(fixture);
    await settle(fixture);
    expect(probed).toEqual(['http://192.168.1.20:8080']);
    expect(TestBed.inject(ServerUrl).base()).toBe('http://192.168.1.20:8080');
    expect(nav).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('refuses a typed address that is not one, without asking the network', async () => {
    const { fixture, probed } = setup();
    await fill(fixture, '#server', 'http://');
    await submit(fixture);
    expect(probed).toEqual([]);
    expect(alerts(fixture).join(' ')).toContain('Enter an address such as http://192.168.1.20:8080');
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false);
  });

  it('says so and keeps nothing when the server cannot be reached', async () => {
    const { fixture, nav } = setup(() => {
      throw new ConnectError('down', Code.Unavailable);
    });
    await fill(fixture, '#server', 'http://192.168.1.20:8080');
    await submit(fixture);
    await settle(fixture);
    expect(alerts(fixture).join(' ')).toContain('Could not reach the server at http://192.168.1.20:8080');
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false);
    expect(nav).not.toHaveBeenCalled();
  });

  it('a server with no account yet is set up in a browser, and its address is not kept', async () => {
    const { fixture, nav } = setup(() => create(GetServerInfoResponseSchema, { version: '1.0', setupRequired: true }));
    await fill(fixture, '#server', 'http://192.168.1.20:8080');
    await submit(fixture);
    await settle(fixture);
    expect(text(fixture)).toContain('web browser');
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false);
    expect(nav).not.toHaveBeenCalled();
  });

  it('gives up after 5 seconds of silence and says that', async () => {
    const { fixture } = setup(() => new Promise(() => undefined));
    await fill(fixture, '#server', 'http://192.168.1.20:8080');
    await submit(fixture);
    await settle(fixture, 5000);
    expect(alerts(fixture).join(' ')).toContain('did not answer within 5 seconds');
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false);
  });

  it('asks once while an answer is awaited', async () => {
    const { fixture, calls } = setup(() => new Promise(() => undefined));
    await fill(fixture, '#server', 'http://192.168.1.20:8080');
    await submit(fixture);
    await submit(fixture);
    await settle(fixture);
    expect(calls()).toBe(1);
  });

  it('a new address ends the session of the old one', async () => {
    const { fixture } = setup();
    TestBed.inject(ServerUrl).set('http://old.example');
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, {}) }));
    await fill(fixture, '#server', 'http://new.example');
    await submit(fixture);
    await settle(fixture);
    expect(TestBed.inject(AuthStore).signedIn()).toBe(false);
    expect(TestBed.inject(ServerUrl).base()).toBe('http://new.example');
  });

  it('the same address keeps the session', async () => {
    const { fixture } = setup();
    TestBed.inject(ServerUrl).set('http://same.example');
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, {}) }));
    await fill(fixture, '#server', 'http://same.example');
    await submit(fixture);
    await settle(fixture);
    expect(TestBed.inject(AuthStore).signedIn()).toBe(true);
  });
});
