import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { AuthService, LoginRequest, LoginResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, DeviceType, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { LoginPage } from './login.page';
import { alerts, fill, submit } from '../testing';

async function setup(login: () => unknown, url = '/login') {
  const calls: LoginRequest[] = [];
  const transport = createRouterTransport(({ service }) =>
    service(AuthService, {
      login(req) {
        calls.push(req);
        return login() as never;
      },
    }),
  );
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'login', component: LoginPage }]), { provide: TRANSPORT, useValue: transport }],
  });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl(url, LoginPage);
  const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  void page;
  return { fixture: harness.fixture, calls, nav };
}

const ok = (mustChange = false) => () =>
  create(LoginResponseSchema, { auth: create(AuthTokenSchema, { token: 'tok', deviceId: 'd1', user: create(UserSchema, { email: 'a@example.com', mustChangePassword: mustChange }) }) });

async function signInForm(f: Awaited<ReturnType<typeof setup>>['fixture']) {
  await fill(f, '#email', 'a@example.com');
  await fill(f, '#password', 'secret-pass');
  await submit(f);
}

describe('LoginPage', () => {
  it('has labelled fields with the right autocomplete', async () => {
    const { fixture } = await setup(ok());
    const el = fixture.nativeElement as HTMLElement;
    for (const input of Array.from(el.querySelectorAll('input'))) expect(el.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
    expect((el.querySelector('#password') as HTMLInputElement).autocomplete).toBe('current-password');
    expect((el.querySelector('#password') as HTMLInputElement).type).toBe('password');
    expect((el.querySelector('#email') as HTMLInputElement).autocomplete).toBe('username');
  });

  it('asks for both fields before calling the server', async () => {
    const { fixture, calls } = await setup(ok());
    await submit(fixture);
    expect(calls.length).toBe(0);
    expect(alerts(fixture).join(' ')).toContain('Enter your email address.');
    expect(alerts(fixture).join(' ')).toContain('Enter your password.');
  });

  it('signs in and opens the library', async () => {
    const { fixture, calls, nav } = await setup(ok());
    await signInForm(fixture);
    expect(calls.length).toBe(1);
    expect(calls[0].email).toBe('a@example.com');
    expect(calls[0].password).toBe('secret-pass');
    expect(calls[0].deviceType).toBe(DeviceType.WEB);
    expect(TestBed.inject(AuthStore).token()).toBe('tok');
    expect(nav).toHaveBeenCalledWith('/library');
  });

  it('goes back to the page the user came from', async () => {
    const { fixture, nav } = await setup(ok(), '/login?returnUrl=%2Fqueue');
    await signInForm(fixture);
    expect(nav).toHaveBeenCalledWith('/queue');
  });

  it('does not follow a return address that leaves the app', async () => {
    const { fixture, nav } = await setup(ok(), '/login?returnUrl=%2F%2Fevil.example');
    await signInForm(fixture);
    expect(nav).toHaveBeenCalledWith('/library');
  });

  it('sends a user with a temporary password to the change-password page', async () => {
    const { fixture, nav } = await setup(ok(true), '/login?returnUrl=%2Fqueue');
    await signInForm(fixture);
    expect(nav).toHaveBeenCalledWith('/me/password');
    expect(TestBed.inject(AuthStore).passwordChangeRequired()).toBe(true);
  });

  it('regression: the password is not kept in the form after a successful sign-in', async () => {
    const { fixture } = await setup(ok());
    await signInForm(fixture);
    expect(((fixture.nativeElement as HTMLElement).querySelector('#password') as HTMLInputElement).value).toBe('');
  });

  it('wrong password: a plain message that does not say which part was wrong', async () => {
    const { fixture, nav } = await setup(() => {
      throw new ConnectError('invalid email or password', Code.Unauthenticated);
    });
    await signInForm(fixture);
    expect(alerts(fixture)).toEqual(['Invalid email or password']);
    expect(TestBed.inject(AuthStore).token()).toBeUndefined();
    expect(nav).not.toHaveBeenCalled();
  });

  it('passes the back-off message through', async () => {
    const { fixture } = await setup(() => {
      throw new ConnectError('try again in 7 s', Code.ResourceExhausted);
    });
    await signInForm(fixture);
    expect(alerts(fixture)).toEqual(['try again in 7 s']);
  });

  it('says when the account is disabled', async () => {
    const { fixture } = await setup(() => {
      throw new ConnectError('account disabled', Code.PermissionDenied);
    });
    await signInForm(fixture);
    expect(alerts(fixture)).toEqual(['This account is disabled.']);
  });

  it('keeps the email but clears the password after a failure', async () => {
    const { fixture } = await setup(() => {
      throw new ConnectError('x', Code.Unauthenticated);
    });
    await signInForm(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect((el.querySelector('#email') as HTMLInputElement).value).toBe('a@example.com');
    expect((el.querySelector('#password') as HTMLInputElement).value).toBe('');
  });
});
