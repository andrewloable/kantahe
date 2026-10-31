import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createRouterTransport } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { AuthTokenSchema } from '../gen/kantahe/v1/common_pb';
import { SessionService } from '../gen/kantahe/v1/session_pb';
import { App } from './app';
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
