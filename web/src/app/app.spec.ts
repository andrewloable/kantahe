import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { createRouterTransport } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { AuthTokenSchema } from '../gen/kantahe/v1/common_pb';
import { SessionService } from '../gen/kantahe/v1/session_pb';
import { App } from './app';
import { appConfig } from './app.config';
import { PageTitleStrategy } from './core/page-title';
import { TRANSPORT } from './core/api';
import { AuthStore } from './core/auth.store';
import { StateStore } from './core/state.store';
import { ToastService } from './core/toast';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    const transport = createRouterTransport(({ service }) =>
      service(SessionService, {
        // eslint-disable-next-line require-yield -- the stream just stays quiet
        async *watchState(_req, ctx) {
          await new Promise<void>((resolve) => ctx.signal.addEventListener('abort', () => resolve()));
        },
      }),
    );
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([]), { provide: TRANSPORT, useValue: transport }] }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('is only a place for the pages and the toasts: the menu belongs to the shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('router-outlet')).not.toBeNull();
    expect(el.querySelector('app-toasts')).not.toBeNull();
    expect(el.querySelector('nav')).toBeNull();
    expect(el.querySelector('h1')).toBeNull();
  });

  it('shows toasts on every page', async () => {
    const fixture = TestBed.createComponent(App);
    TestBed.inject(ToastService).show('Hello there');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Hello there');
  });

  it('keeps the live state following the sign-in', async () => {
    const fixture = TestBed.createComponent(App);
    const store = TestBed.inject(StateStore);
    const start = vi.spyOn(store, 'start');
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
    await fixture.whenStable();
    expect(start).toHaveBeenCalled();
    store.stop();
  });
});

describe('appConfig', () => {
  it('regression: the app sets the page titles with its own strategy (route titles were not shown)', () => {
    expect(appConfig.providers).toContainEqual({ provide: TitleStrategy, useClass: PageTitleStrategy });
  });
});

describe('App and the splash of index.html', () => {
  const had = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const addSplash = () => document.body.insertAdjacentHTML('afterbegin', '<div id="splash"></div>');

  beforeEach(async () => {
    localStorage.clear();
    // jsdom has no matchMedia: motion is allowed here, so the splash fades out (class "done") before it is removed
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: (q: string) => ({ matches: false, media: q }) as MediaQueryList });
    const transport = createRouterTransport(({ service }) =>
      service(SessionService, {
        // eslint-disable-next-line require-yield -- the stream just stays quiet
        async *watchState(_req, ctx) {
          await new Promise<void>((resolve) => ctx.signal.addEventListener('abort', () => resolve()));
        },
      }),
    );
    @Component({ template: 'page' })
    class Page {}
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([{ path: '**', component: Page }]), { provide: TRANSPORT, useValue: transport }],
    }).compileComponents();
    addSplash();
  });

  afterEach(() => {
    document.getElementById('splash')?.remove();
    if (had) Object.defineProperty(window, 'matchMedia', had);
    else delete (window as { matchMedia?: unknown }).matchMedia;
  });

  const splash = () => document.getElementById('splash');

  it('keeps the splash until the first page is on screen, then takes it off once', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(splash()?.classList.contains('done')).toBe(false); // the app exists but no page is shown yet
    await router.navigateByUrl('/first');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(splash()?.classList.contains('done')).toBe(true);
  });

  it('does nothing on later navigations', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/first');
    fixture.detectChanges();
    await fixture.whenStable();
    splash()!.remove();
    addSplash(); // a splash that is shown again (it never is in the app; this proves that no later navigation touches one)
    await router.navigateByUrl('/second');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(splash()?.classList.contains('done')).toBe(false);
  });

  it('does not wait for a navigation that never ends: the splash stays', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(splash()?.classList.contains('done')).toBe(false);
    fixture.destroy();
  });
});
