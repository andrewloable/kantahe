import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { AuthService, ChangePasswordRequest, ChangePasswordResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { AuthTokenSchema, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { ChangePasswordPage } from './change-password.page';
import { alerts, fill, submit, text } from '../testing';

function setup(change: () => unknown = () => create(ChangePasswordResponseSchema, {}), mustChange = false) {
  const calls: ChangePasswordRequest[] = [];
  const transport = createRouterTransport(({ service }) =>
    service(AuthService, {
      changePassword(req) {
        calls.push(req);
        return change() as never;
      },
    }),
  );
  localStorage.clear();
  TestBed.configureTestingModule({ imports: [ChangePasswordPage], providers: [provideRouter([]), { provide: TRANSPORT, useValue: transport }] });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { email: 'a@example.com', mustChangePassword: mustChange }) }));
  const fixture = TestBed.createComponent(ChangePasswordPage);
  fixture.detectChanges();
  return { fixture, calls };
}

async function fillAll(f: ReturnType<typeof setup>['fixture'], cur = 'old-password', next = 'new-password', again = next) {
  await fill(f, '#current', cur);
  await fill(f, '#new', next);
  await fill(f, '#confirm', again);
}

describe('ChangePasswordPage', () => {
  it('labels every field and sets the autocomplete hints', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    for (const input of Array.from(el.querySelectorAll('input'))) {
      expect(el.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
      expect((input as HTMLInputElement).type).toBe('password');
    }
    expect((el.querySelector('#current') as HTMLInputElement).autocomplete).toBe('current-password');
    expect((el.querySelector('#new') as HTMLInputElement).autocomplete).toBe('new-password');
  });

  it('a confirmation that differs blocks the submit', async () => {
    const { fixture, calls } = setup();
    await fillAll(fixture, 'old-password', 'new-password', 'other-password');
    await submit(fixture);
    expect(calls.length).toBe(0);
    expect(alerts(fixture)).toContain('The passwords do not match.');
  });

  it('checks the length of the new password and that it differs from the current one', async () => {
    const { fixture, calls } = setup();
    await fillAll(fixture, 'old-password', 'short');
    await submit(fixture);
    expect(alerts(fixture)).toContain('The new password must be 8 to 256 characters.');
    await fillAll(fixture, 'old-password', 'old-password');
    await submit(fixture);
    expect(alerts(fixture)).toContain('The new password must differ from the current one.');
    expect(calls.length).toBe(0);
  });

  it('asks for the current password', async () => {
    const { fixture, calls } = setup();
    await fillAll(fixture, '');
    await submit(fixture);
    expect(alerts(fixture)).toContain('Enter your current password.');
    expect(calls.length).toBe(0);
  });

  it('changes the password, says other devices were signed out and offers to continue', async () => {
    const { fixture, calls } = setup(undefined, true);
    await fillAll(fixture);
    await submit(fixture);
    expect(calls.length).toBe(1);
    expect(calls[0].currentPassword).toBe('old-password');
    expect(calls[0].newPassword).toBe('new-password');
    expect(text(fixture)).toContain('Password changed. Other devices were signed out.');
    const link = (fixture.nativeElement as HTMLElement).querySelector('a[href="/library"]');
    expect(link?.textContent).toContain('Continue');
    const auth = TestBed.inject(AuthStore);
    expect(auth.passwordChangeRequired()).toBe(false);
    expect(auth.user()?.mustChangePassword).toBe(false);
    expect(auth.token()).toBe('t');
  });

  it('wrong current password', async () => {
    const { fixture } = setup(() => {
      throw new ConnectError('current password is incorrect', Code.PermissionDenied);
    });
    await fillAll(fixture);
    await submit(fixture);
    expect(alerts(fixture)).toEqual(['Current password is wrong.']);
    expect(text(fixture)).not.toContain('Password changed');
  });

  it('passes the back-off message and server rejections through', async () => {
    let code = Code.ResourceExhausted;
    let msg = 'try again in 4 s';
    const { fixture } = setup(() => {
      throw new ConnectError(msg, code);
    });
    await fillAll(fixture);
    await submit(fixture);
    expect(alerts(fixture)).toEqual(['try again in 4 s']);
    code = Code.InvalidArgument;
    msg = 'password must be 8 to 256 bytes';
    await submit(fixture);
    expect(alerts(fixture)).toEqual(['password must be 8 to 256 bytes']);
  });

  it('clears the password fields after a success', async () => {
    const { fixture } = setup();
    await fillAll(fixture);
    await submit(fixture);
    const el = fixture.nativeElement as HTMLElement;
    for (const id of ['current', 'new', 'confirm']) expect((el.querySelector('#' + id) as HTMLInputElement | null)?.value ?? '').toBe('');
  });
});
