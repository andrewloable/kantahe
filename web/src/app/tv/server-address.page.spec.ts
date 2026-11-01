import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { AuthService, GetServerInfoResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, DeviceType, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { Environment } from '../../environments/environment.model';
import { AuthStore } from '../core/auth.store';
import { ENVIRONMENT } from '../core/environment';
import { ServerUrl } from '../core/server-url';
import { alerts, text } from '../testing';
import { ServerAddressPage } from './server-address.page';
import { Found, FIND_SERVERS, FoundServer, Progress, SERVER_PROBE } from './server-sweep';

const TV: Environment = { isTv: true, tvDeviceType: DeviceType.TIZEN };

@Component({ template: '' })
class Blank {}

const server = (url: string, name = '', setupRequired = false): FoundServer => ({ url, name, version: '2.1', setupRequired });

interface Options {
  info?: () => unknown;
  /** What the search of the network turns up (nothing, unless a test says so). */
  find?: (options: { next: boolean; progress?: Progress }) => Promise<FoundServer[] | Found>;
  returnUrl?: string;
  /** The person chose Use another server before: nothing connects by itself. */
  cleared?: boolean;
  /** An address with a signed-in session that was kept before this page. */
  previous?: string;
}

/** Shows the page and lets the search for servers finish. */
async function setup({ info = () => create(GetServerInfoResponseSchema, { version: '1.0', setupRequired: false }), find = () => Promise.resolve([]), returnUrl, cleared, previous }: Options = {}) {
  localStorage.clear();
  const probed: string[] = [];
  let calls = 0;
  let searches = 0;
  const asked: { next: boolean }[] = [];
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
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) } } },
      {
        provide: SERVER_PROBE,
        useValue: (base: string) => {
          probed.push(base);
          return transport;
        },
      },
      {
        provide: FIND_SERVERS,
        useValue: async (options: { next: boolean; progress?: Progress }) => {
          searches++;
          asked.push({ next: options.next });
          const r = await find(options);
          return Array.isArray(r) ? { servers: r, more: false } : r;
        },
      },
    ],
  });
  if (previous) {
    TestBed.inject(ServerUrl).set(previous);
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, {}) }));
  }
  if (cleared) TestBed.inject(ServerUrl).clear();
  const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true); // before the search, which may end in a navigation
  const fixture = TestBed.createComponent(ServerAddressPage);
  document.body.appendChild(fixture.nativeElement); // focus needs the page to be in the document
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, probed, nav, calls: () => calls, searches: () => searches, asked };
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

  it('asks for the address in a labelled field that starts with http://', async () => {
    const { fixture } = await setup();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('#server') as HTMLInputElement;
    expect(el.querySelector('label[for="server"]')).not.toBeNull();
    expect(input.value).toBe('http://');
    expect(el.querySelector('button[type="submit"]')?.textContent).toContain('Connect');
  });

  it('the remote starts in the address field: the first thing to do here is to type', async () => {
    const { fixture } = await setup();
    expect(document.activeElement).toBe((fixture.nativeElement as HTMLElement).querySelector('#server'));
  });

  it('checks the address with GetServerInfo, stores it and goes on to sign-in', async () => {
    const { fixture, probed, nav } = await setup();
    await fill(fixture, '#server', '192.168.1.20:8080');
    await submit(fixture);
    await settle(fixture);
    expect(probed).toEqual(['http://192.168.1.20:8080']);
    expect(TestBed.inject(ServerUrl).base()).toBe('http://192.168.1.20:8080');
    expect(nav).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('refuses a typed address that is not one, without asking the network', async () => {
    const { fixture, probed } = await setup();
    await fill(fixture, '#server', 'http://');
    await submit(fixture);
    expect(probed).toEqual([]);
    expect(alerts(fixture).join(' ')).toContain('Enter an address such as http://192.168.1.20:8080');
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false);
  });

  it('says so and keeps nothing when the server cannot be reached', async () => {
    const { fixture, nav } = await setup({
      info: () => {
        throw new ConnectError('down', Code.Unavailable);
      },
    });
    await fill(fixture, '#server', 'http://192.168.1.20:8080');
    await submit(fixture);
    await settle(fixture);
    expect(alerts(fixture).join(' ')).toContain('Could not reach the server at http://192.168.1.20:8080');
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false);
    expect(nav).not.toHaveBeenCalled();
  });

  it('a server with no account yet is set up in a browser, and its address is not kept', async () => {
    const { fixture, nav } = await setup({ info: () => create(GetServerInfoResponseSchema, { version: '1.0', setupRequired: true }) });
    await fill(fixture, '#server', 'http://192.168.1.20:8080');
    await submit(fixture);
    await settle(fixture);
    expect(text(fixture)).toContain('web browser');
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false);
    expect(nav).not.toHaveBeenCalled();
  });

  it('gives up after 5 seconds of silence and says that', async () => {
    const { fixture } = await setup({ info: () => new Promise(() => undefined) });
    await fill(fixture, '#server', 'http://192.168.1.20:8080');
    await submit(fixture);
    await settle(fixture, 5000);
    expect(alerts(fixture).join(' ')).toContain('did not answer within 5 seconds');
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false);
  });

  it('asks once while an answer is awaited', async () => {
    const { fixture, calls } = await setup({ info: () => new Promise(() => undefined) });
    await fill(fixture, '#server', 'http://192.168.1.20:8080');
    await submit(fixture);
    await submit(fixture);
    await settle(fixture);
    expect(calls()).toBe(1);
  });

  it('a new address ends the session of the old one', async () => {
    const { fixture } = await setup();
    TestBed.inject(ServerUrl).set('http://old.example');
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, {}) }));
    await fill(fixture, '#server', 'http://new.example');
    await submit(fixture);
    await settle(fixture);
    expect(TestBed.inject(AuthStore).signedIn()).toBe(false);
    expect(TestBed.inject(ServerUrl).base()).toBe('http://new.example');
  });

  it('the same address keeps the session', async () => {
    const { fixture } = await setup();
    TestBed.inject(ServerUrl).set('http://same.example');
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, {}) }));
    await fill(fixture, '#server', 'http://same.example');
    await submit(fixture);
    await settle(fixture);
    expect(TestBed.inject(AuthStore).signedIn()).toBe(true);
  });
});

describe('ServerAddressPage: finding the server', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  const rows = (fixture: { nativeElement: HTMLElement }) => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button[data-server]'));
  const field = (fixture: { nativeElement: HTMLElement }) => (fixture.nativeElement as HTMLElement).querySelector('#server');

  it('says it is looking, with its progress, and offers no address field meanwhile', async () => {
    let report: Progress | undefined;
    let finish: (s: FoundServer[]) => void = () => undefined;
    const { fixture } = await setup({
      find: ({ progress }) => {
        report = progress;
        return new Promise((resolve) => (finish = resolve));
      },
    });
    report?.(253, 506);
    fixture.detectChanges();
    expect(text(fixture)).toContain('Looking for Kantahe servers on this network');
    expect(text(fixture)).toContain('253 of 506');
    expect(field(fixture)).toBeNull();
    finish([]);
    await settle(fixture);
    expect(field(fixture)).not.toBeNull();
  });

  it('REGRESSION: exactly one server is stored without a key press, and sign-in opens', async () => {
    const { nav } = await setup({ find: () => Promise.resolve([server('http://192.168.1.9:8080', 'Den')]) });
    expect(TestBed.inject(ServerUrl).base()).toBe('http://192.168.1.9:8080');
    expect(nav).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('exactly one server, after Use another server, is listed and not stored; choosing it stores it', async () => {
    const { fixture, nav } = await setup({ cleared: true, find: () => Promise.resolve([server('http://192.168.1.9:8080', 'Den')]) });
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false);
    expect(nav).not.toHaveBeenCalled();
    expect(rows(fixture)).toHaveLength(1);
    expect(field(fixture)).toBeNull();
    rows(fixture)[0].click();
    await settle(fixture);
    expect(TestBed.inject(ServerUrl).base()).toBe('http://192.168.1.9:8080');
    expect(nav).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('two servers are listed by name with address and version; the first has the focus; choosing one stores it and keeps the page asked for', async () => {
    const { fixture, nav } = await setup({
      returnUrl: '/queue',
      find: () => Promise.resolve([server('http://192.168.1.9:8080', 'Den'), server('http://192.168.1.12', '')]),
    });
    const list = rows(fixture);
    expect(list).toHaveLength(2);
    expect(list[0].textContent).toContain('Den');
    expect(list[0].textContent).toContain('http://192.168.1.9:8080');
    expect(list[0].textContent).toContain('version 2.1');
    expect(list[1].textContent).toContain('http://192.168.1.12'); // no name: the address is the title
    expect(document.activeElement).toBe(list[0]);
    expect(field(fixture)).toBeNull();
    list[1].click();
    await settle(fixture);
    expect(TestBed.inject(ServerUrl).base()).toBe('http://192.168.1.12');
    expect(nav).toHaveBeenCalledWith('/login?returnUrl=%2Fqueue', { replaceUrl: true });
  });

  it('a lone server that needs setup is listed with the setup text, and nothing is stored', async () => {
    const { fixture, nav } = await setup({ find: () => Promise.resolve([server('http://192.168.1.9:8080', 'Den', true)]) });
    expect(rows(fixture)).toHaveLength(1);
    rows(fixture)[0].click();
    await settle(fixture);
    expect(text(fixture)).toContain('web browser');
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false);
    expect(nav).not.toHaveBeenCalled();
  });

  it('a different server ends the session of the old one, as a typed address does', async () => {
    await setup({ previous: 'http://old.example', find: () => Promise.resolve([server('http://new.example', 'New')]) });
    expect(TestBed.inject(AuthStore).signedIn()).toBe(false);
    expect(TestBed.inject(ServerUrl).base()).toBe('http://new.example');
  });

  it('the same server keeps the session', async () => {
    await setup({ previous: 'http://same.example', find: () => Promise.resolve([server('http://same.example', 'Same')]) });
    expect(TestBed.inject(AuthStore).signedIn()).toBe(true);
  });

  it('nothing found: the address form, with the field focused, and Search again', async () => {
    const { fixture } = await setup();
    expect(field(fixture)).not.toBeNull();
    expect(document.activeElement).toBe(field(fixture));
    expect(text(fixture)).toContain('No Kantahe server was found on this network');
    expect(Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map((b) => b.textContent?.trim())).toContain('Search again');
  });

  it('Search again runs the search again', async () => {
    const { fixture, searches } = await setup();
    expect(searches()).toBe(1);
    const again = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Search again')) as HTMLButtonElement;
    again.click();
    await settle(fixture);
    expect(searches()).toBe(2);
  });

  it('the address form is not shown while at least one server was found', async () => {
    const { fixture } = await setup({ find: () => Promise.resolve([server('http://a', 'A'), server('http://b', 'B')]) });
    expect(field(fixture)).toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
  it('the first search is a new one; Search again from the list is a new one too (the servers may have changed)', async () => {
    const { fixture, asked } = await setup({ find: () => Promise.resolve([server('http://a', 'A'), server('http://b', 'B')]) });
    expect(asked).toEqual([{ next: false }]);
    const again = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Search again')) as HTMLButtonElement;
    again.click();
    await settle(fixture);
    expect(asked).toEqual([{ next: false }, { next: false }]);
  });

  it('nothing found but more addresses to look at: it says so, and Search again asks for the next batch', async () => {
    const { fixture, asked } = await setup({ find: () => Promise.resolve({ servers: [], more: true }) });
    expect(text(fixture)).toContain('No Kantahe server was found on this network yet');
    expect(text(fixture)).toContain('more addresses');
    expect(field(fixture)).not.toBeNull(); // the address can still be typed
    const again = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Search again')) as HTMLButtonElement;
    again.click();
    await settle(fixture);
    expect(asked).toEqual([{ next: false }, { next: true }]);
  });

  it('nothing found and nothing more to look at: the plain message', async () => {
    const { fixture } = await setup({ find: () => Promise.resolve({ servers: [], more: false }) });
    expect(text(fixture)).toContain('No Kantahe server was found on this network.');
    expect(text(fixture)).not.toContain('more addresses');
  });
});
