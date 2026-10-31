import { TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { TRANSPORT } from '../../core/api';
import { ToastService } from '../../core/toast';
import { fakeAdminUsers, user } from '../testing';
import { UsersPage } from './users.page';

async function setup(opts: { revoked?: number } = {}) {
  const server = fakeAdminUsers(
    [
      user('u1', 'ann@example.com', { displayName: 'Ann', admin: true, uploader: true }),
      user('u2', 'bob@example.com', { displayName: 'Bob', uploader: false, mustChangePassword: true }),
      user('u3', 'cy@example.com', { displayName: 'Cy', disabled: true }),
    ],
    { devicesRevoked: opts.revoked },
  );
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  const fixture = TestBed.createComponent(UsersPage);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  fixture.detectChanges();
  await settle();
  const row = (email: string) => Array.from(el.querySelectorAll('tbody tr')).find((r) => r.textContent?.includes(email)) as HTMLElement;
  const box = (email: string, role: 'admin' | 'uploader' | 'disabled') => row(email).querySelector<HTMLInputElement>(`input[type="checkbox"][data-role="${role}"]`)!;
  const button = (within: ParentNode, text: string) => Array.from(within.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(text))!;
  return { fixture, el, server, settle, row, box, button };
}

describe('UsersPage', () => {
  it('lists every user with name, roles, disabled and the must-change flag', async () => {
    const { el, row, box } = await setup();
    expect(el.querySelectorAll('tbody tr').length).toBe(3);
    expect(row('ann@example.com').textContent).toContain('Ann');
    expect(box('ann@example.com', 'admin').checked).toBe(true);
    expect(box('ann@example.com', 'uploader').checked).toBe(true);
    expect(box('bob@example.com', 'uploader').checked).toBe(false);
    expect(box('cy@example.com', 'disabled').checked).toBe(true);
    expect(row('bob@example.com').textContent).toContain('must change password');
    expect(row('ann@example.com').textContent).not.toContain('must change password');
  });

  it('regression: the column headers are marked as headers of their columns', async () => {
    const { el } = await setup();
    expect(Array.from(el.querySelectorAll('th')).every((h) => h.getAttribute('scope') === 'col')).toBe(true);
  });

  it('regression: a table wider than a phone scrolls inside the page and does not widen it (the page scrolled sideways at 390 px)', async () => {
    await setup();
    const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
    expect(css).toMatch(/\[_nghost[^\]]*\]\s*\{[^}]*display:\s*block[^}]*overflow-x:\s*auto/);
  });

  it('is a table with column headers, and every checkbox names its user and role', async () => {
    const { el, box } = await setup();
    expect(Array.from(el.querySelectorAll('th')).map((h) => h.textContent?.trim())).toEqual(['Email', 'Name', 'Admin', 'Uploader', 'Disabled', 'Account', 'Actions']);
    expect(box('bob@example.com', 'uploader').getAttribute('aria-label')).toBe('Uploader: bob@example.com');
    expect(box('bob@example.com', 'admin').getAttribute('aria-label')).toBe('Admin: bob@example.com');
    expect(box('bob@example.com', 'disabled').getAttribute('aria-label')).toBe('Disabled: bob@example.com');
  });

  it('toggling uploader sends UpdateUser with only the uploader set', async () => {
    const { box, server, settle } = await setup();
    box('bob@example.com', 'uploader').click();
    await settle();
    expect(server.calls.update.length).toBe(1);
    const req = server.calls.update[0];
    expect(req.userId).toBe('u2');
    expect(req.uploader).toBe(true);
    expect(req.admin).toBeUndefined();
    expect(req.disabled).toBeUndefined();
    expect(req.displayName).toBeUndefined();
    expect(box('bob@example.com', 'uploader').checked).toBe(true);
  });

  it('toggling admin and disabled each send only their own field', async () => {
    const { box, server, settle } = await setup();
    box('bob@example.com', 'admin').click();
    await settle();
    box('cy@example.com', 'disabled').click();
    await settle();
    expect([server.calls.update[0].admin, server.calls.update[0].uploader, server.calls.update[0].disabled]).toEqual([true, undefined, undefined]);
    expect([server.calls.update[1].disabled, server.calls.update[1].admin, server.calls.update[1].uploader]).toEqual([false, undefined, undefined]);
  });

  it('the last admin protection of the server is shown on that row and the box goes back', async () => {
    const { box, server, settle, row } = await setup();
    server.failNext(new ConnectError('there must be at least one administrator', Code.FailedPrecondition));
    box('ann@example.com', 'admin').click();
    await settle();
    expect(row('ann@example.com').querySelector('[role="alert"]')?.textContent).toContain('there must be at least one administrator');
    expect(box('ann@example.com', 'admin').checked).toBe(true);
  });

  it('regression: a role box is off limits while its change is on its way, so two clicks make one change', async () => {
    const { box, server, settle, fixture } = await setup();
    const first = box('bob@example.com', 'uploader');
    first.click();
    fixture.detectChanges();
    expect(first.disabled).toBe(true);
    await settle();
    expect(first.disabled).toBe(false);
    expect(server.calls.update.length).toBe(1);
    box('bob@example.com', 'uploader').click();
    await settle();
    expect(server.calls.update.length).toBe(2);
    expect(server.calls.update[1].uploader).toBe(false);
  });

  it('regression: a user who is gone says so and the list is read again', async () => {
    const { box, server, settle, row } = await setup();
    server.failNext(new ConnectError('not found', Code.NotFound));
    box('bob@example.com', 'uploader').click();
    await settle();
    expect(server.calls.list).toBe(2);
    expect(row('bob@example.com')?.textContent ?? '').not.toContain('That user no longer exists.'); // the row is re-read; the message is shown where it can be seen
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('That user no longer exists.');
  });

  it('Reset password sends a generated temporary password and shows it once', async () => {
    const { server, settle, row, button, el } = await setup();
    button(row('bob@example.com'), 'Reset password').click();
    await settle();
    button(row('bob@example.com'), 'Yes, reset').click();
    await settle();
    expect(server.calls.reset.length).toBe(1);
    const sent = server.calls.reset[0];
    expect(sent.userId).toBe('u2');
    expect(sent.temporaryPassword).toHaveLength(12);
    const shown = el.querySelector<HTMLInputElement>('app-temp-password-panel input')!;
    expect(shown.value).toBe(sent.temporaryPassword);
    expect(JSON.stringify({ ...localStorage })).not.toContain(sent.temporaryPassword);
    button(el.querySelector('app-temp-password-panel')!, 'Close').click();
    await settle();
    expect(el.querySelector('app-temp-password-panel')).toBeNull();
    expect(el.innerHTML).not.toContain(sent.temporaryPassword);
  });

  it('regression: Reset password and Sign out devices ask first, and Cancel does nothing', async () => {
    const { server, settle, row, button } = await setup();
    button(row('bob@example.com'), 'Reset password').click();
    await settle();
    expect(server.calls.reset).toEqual([]);
    expect(row('bob@example.com').textContent).toContain('Reset the password of bob@example.com?');
    button(row('bob@example.com'), 'Cancel').click();
    await settle();
    expect(server.calls.reset).toEqual([]);
    button(row('bob@example.com'), 'Sign out devices').click();
    await settle();
    expect(server.calls.revoke).toEqual([]);
    expect(row('bob@example.com').textContent).toContain('Sign out all devices of bob@example.com?');
    button(row('bob@example.com'), 'Cancel').click();
    await settle();
    expect(server.calls.revoke).toEqual([]);
    expect(row('bob@example.com').textContent).not.toContain('Yes, ');
  });

  it('a failed reset shows no password', async () => {
    const { server, settle, row, button, el } = await setup();
    server.failNext(new ConnectError('nope', Code.Internal));
    button(row('bob@example.com'), 'Reset password').click();
    await settle();
    button(row('bob@example.com'), 'Yes, reset').click();
    await settle();
    expect(el.querySelector('app-temp-password-panel')).toBeNull();
    expect(row('bob@example.com').querySelector('[role="alert"]')).not.toBeNull();
  });

  it('Sign out devices tells how many were signed out', async () => {
    const { server, settle, row, button } = await setup({ revoked: 2 });
    button(row('bob@example.com'), 'Sign out devices').click();
    await settle();
    button(row('bob@example.com'), 'Yes, sign out').click();
    await settle();
    expect(server.calls.revoke).toEqual(['u2']);
    expect(row('bob@example.com').textContent).toContain('Signed out 2 devices');
  });

  it('counts one device and no device in words', async () => {
    const one = await setup({ revoked: 1 });
    one.button(one.row('bob@example.com'), 'Sign out devices').click();
    await one.settle();
    one.button(one.row('bob@example.com'), 'Yes, sign out').click();
    await one.settle();
    expect(one.row('bob@example.com').textContent).toContain('Signed out 1 device');
    expect(one.row('bob@example.com').textContent).not.toContain('1 devices');
    TestBed.resetTestingModule();
    const none = await setup({ revoked: 0 });
    none.button(none.row('bob@example.com'), 'Sign out devices').click();
    await none.settle();
    none.button(none.row('bob@example.com'), 'Yes, sign out').click();
    await none.settle();
    expect(none.row('bob@example.com').textContent).toContain('No device was signed in');
  });

  it('Delete needs the exact email typed before it can be confirmed', async () => {
    const { server, settle, row, button, el } = await setup();
    button(row('cy@example.com'), 'Delete').click();
    await settle();
    const input = row('cy@example.com').querySelector<HTMLInputElement>('input[type="text"]')!;
    const confirm = button(row('cy@example.com'), 'Delete user') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    for (const wrong of ['cy', 'CY@example.com', 'cy@example.com ', 'ann@example.com']) {
      input.value = wrong;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      expect((button(row('cy@example.com'), 'Delete user') as HTMLButtonElement).disabled, wrong).toBe(true);
    }
    input.value = 'cy@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect((button(row('cy@example.com'), 'Delete user') as HTMLButtonElement).disabled).toBe(false);
    (button(row('cy@example.com'), 'Delete user') as HTMLButtonElement).click();
    await settle();
    expect(server.calls.remove).toEqual(['u3']);
    expect(el.textContent).not.toContain('cy@example.com');
  });

  it('Cancel on the delete question does nothing', async () => {
    const { server, settle, row, button } = await setup();
    button(row('cy@example.com'), 'Delete').click();
    await settle();
    button(row('cy@example.com'), 'Cancel').click();
    await settle();
    expect(server.calls.remove).toEqual([]);
    expect(row('cy@example.com').querySelector('input[type="text"]')).toBeNull();
  });

  it('a refused delete is shown on the row', async () => {
    const { server, settle, row, button } = await setup();
    server.failNext(new ConnectError('you cannot delete your own account', Code.FailedPrecondition));
    button(row('ann@example.com'), 'Delete').click();
    await settle();
    const input = row('ann@example.com').querySelector<HTMLInputElement>('input[type="text"]')!;
    input.value = 'ann@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    (button(row('ann@example.com'), 'Delete user') as HTMLButtonElement).click();
    await settle();
    expect(row('ann@example.com').querySelector('[role="alert"]')?.textContent).toContain('you cannot delete your own account');
  });

  it('a user created with the form appears in the table and the password is shown once', async () => {
    const { el, settle, server } = await setup();
    const fill = (id: string, value: string) => {
      const i = el.querySelector<HTMLInputElement>('#' + id)!;
      i.value = value;
      i.dispatchEvent(new Event('input', { bubbles: true }));
    };
    fill('new-email', 'dee@example.com');
    fill('new-name', 'Dee');
    fill('new-password', 'Abcd2345wxyz');
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(server.calls.create.length).toBe(1);
    expect(el.querySelectorAll('tbody tr').length).toBe(4);
    expect(el.querySelector<HTMLInputElement>('app-temp-password-panel input')?.value).toBe('Abcd2345wxyz');
  });

  it('the list failing to load is said, with a way to try again', async () => {
    const server = fakeAdminUsers([user('u1', 'ann@example.com')]);
    server.failNext(new ConnectError('down', Code.Unavailable));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/could not reach the server/i);
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Try again'))!.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect(el.textContent).toContain('ann@example.com');
  });
});
