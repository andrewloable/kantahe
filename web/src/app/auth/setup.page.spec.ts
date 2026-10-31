import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { AuthService, SetupRequest, SetupResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, DeviceType, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { SetupPage } from './setup.page';
import { alerts, fill, submit, text } from '../testing';

function setup(result: () => unknown = () => create(SetupResponseSchema, { auth: create(AuthTokenSchema, { token: 'tok', deviceId: 'd1', user: create(UserSchema, { email: 'a@example.com', admin: true }) }) })) {
  const calls: SetupRequest[] = [];
  const transport = createRouterTransport(({ service }) =>
    service(AuthService, {
      setup(req) {
        calls.push(req);
        return result() as never;
      },
    }),
  );
  localStorage.clear();
  TestBed.configureTestingModule({ imports: [SetupPage], providers: [provideRouter([]), { provide: TRANSPORT, useValue: transport }] });
  const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SetupPage);
  fixture.detectChanges();
  return { fixture, calls, nav };
}

async function fillAll(f: ReturnType<typeof setup>['fixture'], over: Partial<Record<'email' | 'name' | 'pw' | 'pw2', string>> = {}) {
  await fill(f, '#email', over.email ?? 'a@example.com');
  await fill(f, '#displayName', over.name ?? 'Andrew');
  await fill(f, '#password', over.pw ?? 'longenough');
  await fill(f, '#confirm', over.pw2 ?? over.pw ?? 'longenough');
}

describe('SetupPage', () => {
  it('has a label for every field and proper password inputs', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    for (const input of Array.from(el.querySelectorAll('input'))) {
      expect(el.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
    }
    expect((el.querySelector('#password') as HTMLInputElement).type).toBe('password');
    expect((el.querySelector('#password') as HTMLInputElement).autocomplete).toBe('new-password');
    expect((el.querySelector('#confirm') as HTMLInputElement).autocomplete).toBe('new-password');
    expect((el.querySelector('#email') as HTMLInputElement).autocomplete).toBe('email');
  });

  it('empty form: shows every message and does not call the server', async () => {
    const { fixture, calls } = setup();
    await submit(fixture);
    expect(calls.length).toBe(0);
    const t = alerts(fixture).join(' | ');
    expect(t).toContain('Enter a valid email address.');
    expect(t).toContain('Enter your name');
    expect(t).toContain('The password must be 8 to 256 characters.');
  });

  it('rejects a bad email', async () => {
    const { fixture, calls } = setup();
    await fillAll(fixture, { email: 'not-an-email' });
    await submit(fixture);
    expect(alerts(fixture)).toContain('Enter a valid email address.');
    expect(calls.length).toBe(0);
  });

  it('rejects a short password', async () => {
    const { fixture, calls } = setup();
    await fillAll(fixture, { pw: 'short' });
    await submit(fixture);
    expect(alerts(fixture)).toContain('The password must be 8 to 256 characters.');
    expect(calls.length).toBe(0);
  });

  it('rejects a confirmation that differs', async () => {
    const { fixture, calls } = setup();
    await fillAll(fixture, { pw: 'longenough', pw2: 'longenough!' });
    await submit(fixture);
    expect(alerts(fixture)).toContain('The passwords do not match.');
    expect(calls.length).toBe(0);
  });

  it('signs up once, signs in and opens the library', async () => {
    const { fixture, calls, nav } = setup();
    await fillAll(fixture, { email: ' a@example.com ', name: ' Andrew ' });
    await submit(fixture);
    expect(calls.length).toBe(1);
    expect(calls[0].email).toBe('a@example.com');
    expect(calls[0].displayName).toBe('Andrew');
    expect(calls[0].password).toBe('longenough');
    expect(calls[0].deviceType).toBe(DeviceType.WEB);
    expect(calls[0].deviceName.length).toBeGreaterThan(0);
    const auth = TestBed.inject(AuthStore);
    expect(auth.token()).toBe('tok');
    expect(auth.user()?.email).toBe('a@example.com');
    expect(nav).toHaveBeenCalledWith('/library');
  });

  it('regression: passwords are not kept in the form after a successful sign-up', async () => {
    const { fixture } = setup();
    await fillAll(fixture);
    await submit(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect((el.querySelector('#password') as HTMLInputElement).value).toBe('');
    expect((el.querySelector('#confirm') as HTMLInputElement).value).toBe('');
  });

  it('ignores a second submit while the first is running', async () => {
    const { fixture, calls } = setup();
    await fillAll(fixture);
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(calls.length).toBe(1);
  });

  it('shows the server problem inline and stays signed out', async () => {
    const { fixture, nav } = setup(() => {
      throw new ConnectError('setup is already complete', Code.FailedPrecondition);
    });
    await fillAll(fixture);
    await submit(fixture);
    expect(alerts(fixture).join(' ')).toContain('Setup is already complete');
    expect(text(fixture)).toContain('Sign in');
    expect(TestBed.inject(AuthStore).token()).toBeUndefined();
    expect(nav).not.toHaveBeenCalled();
  });

  it('shows a rejected field from the server and lets the user try again', async () => {
    let n = 0;
    const { fixture, calls } = setup(() => {
      if (n++ === 0) throw new ConnectError('invalid email address', Code.InvalidArgument);
      return create(SetupResponseSchema, { auth: create(AuthTokenSchema, { token: 't', deviceId: 'd' }) });
    });
    await fillAll(fixture);
    await submit(fixture);
    expect(alerts(fixture).join(' ')).toContain('invalid email address');
    await submit(fixture);
    expect(calls.length).toBe(2);
    expect(alerts(fixture)).toEqual([]);
  });

  it('says so when the server cannot be reached', async () => {
    const { fixture } = setup(() => {
      throw new ConnectError('down', Code.Unavailable);
    });
    await fillAll(fixture);
    await submit(fixture);
    expect(alerts(fixture).join(' ')).toMatch(/could not reach the server/i);
  });
});
