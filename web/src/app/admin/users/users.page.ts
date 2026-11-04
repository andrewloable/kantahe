import { afterNextRender, Component, DestroyRef, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { Code, ConnectError } from '@connectrpc/connect';
import { AdminService } from '../../../gen/kantahe/v1/admin_pb';
import { User } from '../../../gen/kantahe/v1/common_pb';
import { injectClient } from '../../core/api';
import { fromServer, problem } from '../../core/errors';
import { ToastService } from '../../core/toast';
import { CreatedUser, UserFormComponent } from './user-form.component';
import { generateTempPassword } from './temp-password';
import { TempPasswordPanelComponent } from './temp-password-panel.component';

type Role = 'admin' | 'disabled';

@Component({
  selector: 'app-users-page',
  imports: [UserFormComponent, TempPasswordPanelComponent],
  template: `
    <div class="page">
    <div class="head">
      <h2>Users</h2>
      <button #opener type="button" class="primary" (click)="openNew()">New user</button>
    </div>
    @if (shown(); as s) {
      <app-temp-password-panel [email]="s.email" [password]="s.password" (closed)="shown.set(undefined)" />
    }
    @if (loadError()) {
      <p class="error" role="alert">{{ loadError() }} <button type="button" (click)="load()">Try again</button></p>
    }
    <table role="table">
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader">Email</th>
          <th scope="col" role="columnheader">Name</th>
          <th scope="col" role="columnheader">Admin</th>
          <th scope="col" role="columnheader">Disabled</th>
          <th scope="col" role="columnheader">Account</th>
          <th scope="col" role="columnheader">Actions</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        @for (u of users(); track u.id) {
          <tr role="row">
            <td role="cell">{{ u.email }}</td>
            <td role="cell">{{ u.displayName }}</td>
            <td role="cell"><label class="role"><input type="checkbox" data-role="admin" [attr.aria-label]="'Admin: ' + u.email" [checked]="u.admin" [disabled]="pending().has(u.id + ':admin')" (change)="toggle(u, 'admin', $event)" /><span class="role-name">Admin</span></label></td>
            <td role="cell"><label class="role"><input type="checkbox" data-role="disabled" [attr.aria-label]="'Disabled: ' + u.email" [checked]="u.disabled" [disabled]="pending().has(u.id + ':disabled')" (change)="toggle(u, 'disabled', $event)" /><span class="role-name">Disabled</span></label></td>
            <td role="cell">{{ u.mustChangePassword ? 'must change password' : '' }}</td>
            <td role="cell" class="actions" [class.one-line]="deleting() !== u.id && confirming()?.id !== u.id && !notice()[u.id] && !problems()[u.id]">
              @if (deleting() === u.id) {
                <label [for]="'confirm-' + u.id">Type {{ u.email }} to delete this user</label>
                <input [id]="'confirm-' + u.id" type="text" autocomplete="off" [value]="typed()" (input)="typed.set(value($event))" />
                <button class="danger primary" type="button" [disabled]="typed() !== u.email" (click)="remove(u)">Delete user</button>
                <button class="quiet" type="button" (click)="deleting.set(undefined)">Cancel</button>
              } @else if (confirming()?.id === u.id) {
                @if (confirming()?.action === 'reset') {
                  <span>Reset the password of {{ u.email }}? The old one stops working and they must choose a new one.</span>
                  <button class="primary" type="button" (click)="reset(u)">Yes, reset</button>
                } @else {
                  <span>Sign out all devices of {{ u.email }}?</span>
                  <button class="danger primary" type="button" (click)="revoke(u)">Yes, sign out</button>
                }
                <button class="quiet" type="button" (click)="confirming.set(undefined)">Cancel</button>
              } @else {
                <button type="button" [attr.aria-label]="'Reset password of ' + u.email" (click)="confirm(u, 'reset')">Reset password</button>
                <button class="danger" type="button" [attr.aria-label]="'Sign out devices of ' + u.email" (click)="confirm(u, 'revoke')">Sign out devices</button>
                <button class="danger" type="button" [attr.aria-label]="'Delete ' + u.email" (click)="ask(u)">Delete</button>
              }
              @if (notice()[u.id]) {
                <span class="notice" role="status">{{ notice()[u.id] }}</span>
              }
              @if (problems()[u.id]) {
                <span class="error" role="alert">{{ problems()[u.id] }}</span>
              }
            </td>
          </tr>
        }
      </tbody>
    </table>
    </div>
    @if (adding()) {
      <div class="backdrop" aria-hidden="true" (click)="closeNew()"></div>
      <div class="dialog" role="dialog" aria-modal="true" data-back-closes aria-labelledby="new-user-title" (keydown.escape)="closeNew()">
        <app-user-form (created)="created($event); closeNew(false)" (cancelled)="closeNew()" />
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    /* the page is the container of the table's breakpoints and scrolls on its own; the dialog is outside it: a container (layout containment)
       would be the containing block of a fixed dialog, and its scrolling would clip it */
    .page {
      overflow-x: auto;
      container-type: inline-size;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1rem;
    }
    /* above the tab bar of a phone (z-index 20): the dialog is modal (the same as the song edit dialog) */
    .backdrop {
      position: fixed;
      z-index: 40;
      inset: 0;
      background: rgb(0 0 0 / 0.45);
    }
    /* it fits a phone on its side and one with the keyboard open: it starts near the top and scrolls inside */
    .dialog {
      position: fixed;
      z-index: 41;
      left: 50%;
      top: 1rem;
      transform: translateX(-50%);
      width: min(28rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
      overscroll-behavior-y: contain;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: 0.75rem;
      background: var(--panel);
      box-shadow: 0 8px 30px rgb(0 0 0 / 0.4);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 0.4rem;
      text-align: left;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    /* the buttons alone (no question, no message) stay on one line where the table has room (a desktop): a wrapping cell let the name
       columns take the room; on a tablet they may wrap, so that the table never gets wider than the window */
    @container (min-width: 60rem) {
      .actions.one-line {
        flex-wrap: nowrap;
      }
      /* and do not shrink: a squeezed button broke its label onto two lines */
      .actions.one-line button {
        flex-shrink: 0;
        white-space: nowrap;
      }
    }
    input[type='checkbox'] {
      width: 1.5rem;
      height: 1.5rem;
    }
    /* the checkbox and its name are one 44 px target; in the table the column header names it, so the name is only for screen readers there */
    .role {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 2.75rem;
      margin: 0;
    }
    .role-name {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    /* on a phone each user is a block: address, name, the three roles, the state, then the buttons */
    /* the width of the page's own box, in rem: with a larger text size a table that needs 44rem no longer fits, and the blocks come sooner */
    @container (max-width: 44rem) {
      .page {
        overflow-x: visible;
      }
      table,
      tbody,
      tr,
      td {
        display: block;
      }
      thead {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      tr {
        padding: 0.75rem 0;
        border-bottom: 1px solid var(--line);
      }
      td {
        padding: 0.15rem 0;
        border-bottom: 0;
        overflow-wrap: anywhere;
      }
      .role-name {
        position: static;
        width: auto;
        height: auto;
        overflow: visible;
        clip-path: none;
      }
      td.actions {
        padding-top: 0.5rem;
      }

    }
    .notice {
      color: var(--muted);
    }
  `,
})
export class UsersPage {
  private readonly admins = injectClient(AdminService);

  protected readonly users = signal<User[]>([]);
  protected readonly loadError = signal('');
  protected readonly shown = signal<{ email: string; password: string } | undefined>(undefined);
  protected readonly deleting = signal<string | undefined>(undefined);
  protected readonly typed = signal('');
  protected readonly problems = signal<Record<string, string>>({});
  protected readonly notice = signal<Record<string, string>>({});
  protected readonly confirming = signal<{ id: string; action: 'reset' | 'revoke' } | undefined>(undefined);
  /** Role boxes with a change on its way, as user id and role. */
  protected readonly pending = signal<ReadonlySet<string>>(new Set());
  /** The New user dialog is open. */
  protected readonly adding = signal(false);
  private readonly opener = viewChild.required<ElementRef<HTMLButtonElement>>('opener');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly toast = inject(ToastService);
  private gone = false;

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.gone = true));
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      const res = await this.admins.listUsers({});
      if (this.gone) return;
      this.users.set(res.users);
      this.loadError.set('');
    } catch (e) {
      this.loadError.set(problem(e, {}));
    }
  }

  private mark(map: typeof this.problems | typeof this.notice, id: string, text: string): void {
    map.update((m) => ({ ...m, [id]: text }));
  }

  private startAction(id: string): void {
    this.mark(this.problems, id, '');
    this.mark(this.notice, id, '');
  }

  private fail(id: string, e: unknown): void {
    if (ConnectError.from(e).code === Code.NotFound) {
      // another administrator deleted the user meanwhile: say so and read the list again
      this.toast.show('That user no longer exists.', 'error');
      void this.load();
      return;
    }
    this.mark(this.problems, id, problem(e, { [Code.FailedPrecondition]: fromServer }));
  }

  protected confirm(u: User, action: 'reset' | 'revoke'): void {
    this.startAction(u.id);
    this.confirming.set({ id: u.id, action });
  }

  /** Changes one field of one user; the others are not sent. */
  protected async toggle(u: User, role: Role, event: Event): Promise<void> {
    const box = event.target as HTMLInputElement;
    const key = `${u.id}:${role}`;
    if (this.pending().has(key)) return;
    this.startAction(u.id);
    this.pending.update((p) => new Set(p).add(key));
    try {
      const res = await this.admins.updateUser({ userId: u.id, [role]: box.checked });
      if (res.user) this.users.update((all) => all.map((x) => (x.id === u.id ? res.user! : x)));
    } catch (e) {
      box.checked = !box.checked;
      this.fail(u.id, e);
    } finally {
      this.pending.update((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }

  /** Opens the dialog; the focus goes to its first box. */
  protected openNew(): void {
    this.adding.set(true);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>('#new-email')?.focus(), { injector: this.injector });
  }

  /** Closes it; the focus goes back to the button (after a created user too: the page shows the password panel). */
  protected closeNew(refocus = true): void {
    this.adding.set(false);
    if (refocus) afterNextRender(() => this.opener().nativeElement.focus(), { injector: this.injector });
  }

  protected created(c: CreatedUser): void {
    this.users.update((all) => [...all, c.user]);
    this.shown.set({ email: c.user.email, password: c.password });
  }

  protected async reset(u: User): Promise<void> {
    this.startAction(u.id);
    this.confirming.set(undefined);
    const temporaryPassword = generateTempPassword();
    try {
      await this.admins.resetPassword({ userId: u.id, temporaryPassword });
      this.shown.set({ email: u.email, password: temporaryPassword });
    } catch (e) {
      this.fail(u.id, e);
    }
  }

  protected async revoke(u: User): Promise<void> {
    this.startAction(u.id);
    this.confirming.set(undefined);
    try {
      const { revoked } = await this.admins.revokeUserDevices({ userId: u.id });
      this.mark(this.notice, u.id, revoked === 0 ? 'No device was signed in' : `Signed out ${revoked} ${revoked === 1 ? 'device' : 'devices'}`);
    } catch (e) {
      this.fail(u.id, e);
    }
  }

  protected ask(u: User): void {
    this.startAction(u.id);
    this.typed.set('');
    this.deleting.set(u.id);
  }

  protected async remove(u: User): Promise<void> {
    if (this.typed() !== u.email) return;
    try {
      await this.admins.deleteUser({ userId: u.id });
      this.users.update((all) => all.filter((x) => x.id !== u.id));
      this.deleting.set(undefined);
    } catch (e) {
      this.fail(u.id, e);
    }
  }
}
