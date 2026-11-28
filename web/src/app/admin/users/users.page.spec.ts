import { provideRouter } from '@angular/router';
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
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: server.transport }] }); // the router: the Help link
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
  const find = (within: ParentNode, text: string) => Array.from(within.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(text));
  // a row's actions are in its More menu (kantahe-qzr.1): open it when the action is not on screen
  const button = (within: ParentNode, text: string) => {
    const more = (within as HTMLElement).querySelector?.<HTMLButtonElement>('tbody button.more, td button.more');
    if (!find(within, text) && more && within !== el) {
      more.click();
      fixture.detectChanges();
    }
    return find(within, text)!;
  };
  /** The items of a row's More menu, opened (and closed again when `close`). */
  const menu = (email: string) => {
    row(email).querySelector<HTMLButtonElement>('button.more')!.click();
    fixture.detectChanges();
    const items = Array.from(row(email).querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    return items;
  };
  const badges = (email: string) => Array.from(row(email).querySelectorAll('.badge')).map((b) => b.textContent?.trim());
  return { fixture, el, server, settle, row, button, menu, badges };
}

describe('UsersPage', () => {
  it('lists every user with name and the state as badges: Admin, Disabled, Must change password', async () => {
    const { el, row, badges } = await setup();
    expect(el.querySelectorAll('tbody tr').length).toBe(3);
    expect(row('ann@example.com').textContent).toContain('Ann');
    expect(badges('ann@example.com')).toEqual(['Admin']);
    expect(badges('bob@example.com')).toEqual(['Must change password']);
    expect(badges('cy@example.com')).toEqual(['Disabled']);
  });

  // kantahe-qzr.1: one compact row per user, the actions in a More menu (a phone showed one user per screen, every row with two red buttons)
  it('regression: a row has one button, More actions for its user, and no checkbox', async () => {
    const { row } = await setup();
    expect(Array.from(row('bob@example.com').querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))).toEqual(['More actions for bob@example.com']);
    expect(row('bob@example.com').querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('the More menu says what each action does to that user', async () => {
    const { menu } = await setup();
    expect(menu('bob@example.com').map((b) => b.textContent?.trim())).toEqual(['Make administrator', 'Disable', 'Reset password', 'Sign out devices', 'Delete']);
    expect(menu('ann@example.com').map((b) => b.textContent?.trim())).toEqual(['Remove administrator', 'Disable', 'Reset password', 'Sign out devices', 'Delete']);
    expect(menu('cy@example.com').map((b) => b.textContent?.trim())).toEqual(['Make administrator', 'Enable', 'Reset password', 'Sign out devices', 'Delete']);
  });

  it('regression: the column headers are marked as headers of their columns', async () => {
    const { el } = await setup();
    expect(Array.from(el.querySelectorAll('th')).every((h) => h.getAttribute('scope') === 'col')).toBe(true);
  });

  it('regression: a table wider than a phone scrolls inside the page and does not widen it (the page scrolled sideways at 390 px)', async () => {
    await setup();
    const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
    expect(css).toMatch(/\.page\[[^\]]*\]\s*\{[^}]*overflow-x:\s*auto/); // the page box; the dialog is outside it (a scroller would clip it)
  });

  it('is a table with column headers Email, Name, State and Actions', async () => {
    const { el } = await setup();
    expect(Array.from(el.querySelectorAll('th')).map((h) => h.textContent?.trim())).toEqual(['Email', 'Name', 'State', 'Actions']);
  });

  it('has no Uploader column or switch: only administrators upload', async () => {
    const { el } = await setup();
    expect(el.textContent).not.toContain('Uploader');
    expect(el.querySelector('input[data-role="uploader"]')).toBeNull();
  });

  it('Make administrator and Enable each send only their own field', async () => {
    const { button, row, server, settle } = await setup();
    button(row('bob@example.com'), 'Make administrator').click();
    await settle();
    button(row('cy@example.com'), 'Enable').click();
    await settle();
    expect([server.calls.update[0].admin, server.calls.update[0].disabled]).toEqual([true, undefined]);
    expect([server.calls.update[1].disabled, server.calls.update[1].admin]).toEqual([false, undefined]);
    expect(server.calls.update.map((u) => u.uploader)).toEqual([undefined, undefined]); // the old role is never sent
  });

  it('the last admin protection of the server is shown on that row and the badge stays', async () => {
    const { button, server, settle, row, badges } = await setup();
    server.failNext(new ConnectError('there must be at least one administrator', Code.FailedPrecondition));
    button(row('ann@example.com'), 'Remove administrator').click();
    await settle();
    expect(row('ann@example.com').querySelector('[role="alert"]')?.textContent).toContain('there must be at least one administrator');
    expect(badges('ann@example.com')).toEqual(['Admin']);
  });

  it('regression: a role change is off limits while it is on its way, so two clicks make one change', async () => {
    const { button, row, menu, server, settle } = await setup();
    button(row('bob@example.com'), 'Disable').click();
    const items = menu('bob@example.com');
    expect(items.find((b) => b.textContent?.trim() === 'Disable')!.disabled).toBe(true);
    menu('bob@example.com'); // closes it
    await settle();
    expect(server.calls.update.length).toBe(1);
    button(row('bob@example.com'), 'Enable').click();
    await settle();
    expect(server.calls.update.length).toBe(2);
    expect(server.calls.update[1].disabled).toBe(false);
  });

  it('regression: a user who is gone says so and the list is read again', async () => {
    const { button, server, settle, row } = await setup();
    server.failNext(new ConnectError('not found', Code.NotFound));
    button(row('bob@example.com'), 'Disable').click();
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

  it('regression: Delete and Sign out devices are danger buttons, Reset password a plain one, Cancel a quiet one', async () => {
  const { settle, row, button } = await setup();
  expect(button(row('bob@example.com'), 'Delete').classList.contains('danger')).toBe(true);
  expect(button(row('bob@example.com'), 'Sign out devices').classList.contains('danger')).toBe(true);
  expect(button(row('bob@example.com'), 'Reset password').className).toBe('');
  button(row('bob@example.com'), 'Reset password').click();
  await settle();
  expect(button(row('bob@example.com'), 'Cancel').classList.contains('quiet')).toBe(true);
  expect(button(row('bob@example.com'), 'Yes, reset').classList.contains('primary')).toBe(true);
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

  // kantahe-qzr.2 review: the More button that had the focus is replaced by the question; the focus goes into the question
  it('regression: after choosing Reset password or Delete in the menu, the focus is in the question', async () => {
    const { el, settle, row, button } = await setup();
    document.body.appendChild(el);
    button(row('bob@example.com'), 'Reset password').click();
    await settle();
    expect(document.activeElement?.textContent?.trim()).toBe('Yes, reset');
    button(row('bob@example.com'), 'Cancel').click();
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('More actions for bob@example.com'); // and back after Cancel
    button(row('cy@example.com'), 'Delete').click();
    await settle();
    expect(document.activeElement?.id).toBe('confirm-u3');
    el.remove();
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

  describe('New user', () => {
    const open = async () => {
      const r = await setup();
      const opener = r.button(r.el, 'New user') as HTMLButtonElement;
      const fill = (id: string, value: string) => {
        const i = r.el.querySelector<HTMLInputElement>('#' + id)!;
        i.value = value;
        i.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const dialog = () => r.el.querySelector('[role="dialog"]');
      return { ...r, opener, fill, dialog };
    };

    it('the page has a New user button and no form until it is pressed', async () => {
      const { el, opener, dialog } = await open();
      expect(opener).toBeTruthy();
      expect(el.querySelector('#new-email')).toBeNull();
      expect(dialog()).toBeNull();
    });

    it('pressing it opens a modal dialog named New user with the four fields, and the focus is on Email', async () => {
      const { el, opener, dialog, settle } = await open();
      opener.click();
      await settle();
      await settle();
      const d = dialog()!;
      expect(d.getAttribute('aria-modal')).toBe('true');
      expect(d.hasAttribute('data-back-closes')).toBe(true);
      expect(d.getAttribute('aria-labelledby')).toBe('new-user-title');
      expect(el.querySelector('#new-user-title')?.textContent?.trim()).toBe('New user');
      for (const id of ['new-email', 'new-name', 'new-password', 'new-admin']) expect(d.querySelector('#' + id), id).not.toBeNull();
      expect(Array.from(d.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual(expect.arrayContaining(['Generate', 'Create user', 'Cancel']));
      expect(document.activeElement?.id).toBe('new-email');
    });

    it('Cancel, Escape and the backdrop close it without sending anything, and the focus goes back to the button', async () => {
      const { el, opener, dialog, settle, server, button } = await open();
      for (const how of ['cancel', 'escape', 'backdrop']) {
        opener.click();
        await settle();
        await settle();
        expect(dialog(), how).not.toBeNull();
        if (how === 'cancel') (button(dialog()!, 'Cancel') as HTMLButtonElement).click();
        else if (how === 'escape') dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        else el.querySelector<HTMLElement>('.backdrop')!.click();
        await settle();
        await settle();
        expect(dialog(), how).toBeNull();
        expect(document.activeElement, how).toBe(opener);
      }
      expect(server.calls.create.length).toBe(0);
    });

    it('a user created in it appears in the table, the dialog closes and the password is shown once', async () => {
      const { el, opener, fill, dialog, settle, server } = await open();
      opener.click();
      await settle();
      fill('new-email', 'dee@example.com');
      fill('new-name', 'Dee');
      fill('new-password', 'Abcd2345wxyz');
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle();
      expect(server.calls.create.length).toBe(1);
      expect(dialog()).toBeNull();
      expect(el.querySelectorAll('tbody tr').length).toBe(4);
      expect(el.querySelector<HTMLInputElement>('app-temp-password-panel input')?.value).toBe('Abcd2345wxyz');
    });

    it('a refusal (the email is in use) stays in the dialog, with its fields', async () => {
      const { el, opener, fill, dialog, settle, server } = await open();
      opener.click();
      await settle();
      fill('new-email', 'ann@example.com');
      fill('new-name', 'Another Ann');
      fill('new-password', 'Abcd2345wxyz');
      server.failNext(new ConnectError('exists', Code.AlreadyExists));
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle();
      expect(dialog()).not.toBeNull();
      expect(dialog()!.querySelector('[role="alert"]')?.textContent).toContain('Email already in use');
      expect(dialog()!.querySelector<HTMLInputElement>('#new-name')!.value).toBe('Another Ann');
    });
  });

  it('the list failing to load is said, with a way to try again', async () => {
    const server = fakeAdminUsers([user('u1', 'ann@example.com')]);
    server.failNext(new ConnectError('down', Code.Unavailable));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: server.transport }] }); // the router: the Help link
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
