import { RouterLink } from '@angular/router';
import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { Code, ConnectError } from '@connectrpc/connect';
import { AdminService } from '../../../gen/kantahe/v1/admin_pb';
import { User } from '../../../gen/kantahe/v1/common_pb';
import { injectClient } from '../../core/api';
import { fromServer, problem } from '../../core/errors';
import { ToastService } from '../../core/toast';
import { CreatedUser, UserFormComponent } from './user-form.component';
import { generateTempPassword } from './temp-password';
import { TempPasswordPanelComponent } from './temp-password-panel.component';
import { ActionMenuComponent, MenuItem } from '../../shared/action-menu.component';

type Role = 'admin' | 'disabled';

@Component({
  selector: 'app-users-page',
  imports: [UserFormComponent, TempPasswordPanelComponent, ActionMenuComponent, RouterLink],
  template: `
    <div class="page">
    <div class="head">
      <h2>Users</h2>
      <a class="help-link" routerLink="/me/help" fragment="admin">Help</a>
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
          <th scope="col" role="columnheader">State</th>
          <th scope="col" role="columnheader">Actions</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        @for (u of users(); track u.id) {
          <tr role="row" [attr.data-user]="u.id" [class.asking]="asking(u)">
            <td role="cell" class="email" [attr.title]="u.email">{{ u.email }}</td>
            <td role="cell" class="name">{{ u.displayName }}</td>
            <!-- the state in words, not a colour alone (kantahe-qzr.1) -->
            <td role="cell" class="state">
              @if (u.admin) {
                <span class="badge">Admin</span>
              }
              @if (u.disabled) {
                <span class="badge off">Disabled</span>
              }
              @if (u.mustChangePassword) {
                <span class="badge">Must change password</span>
              }
            </td>
            <td role="cell" class="actions-cell">
              <!-- the flex box is inside the cell: a flex cell drew its bottom line at its own height (kantahe-qzr.1) -->
              <div class="actions">
                @if (deleting() === u.id) {
                  <label [for]="'confirm-' + u.id">Type {{ u.email }} to delete this user</label>
                  <input [id]="'confirm-' + u.id" type="text" autocomplete="off" [value]="typed()" (input)="typed.set(value($event))" />
                  <button class="danger primary" type="button" [disabled]="typed() !== u.email" (click)="remove(u)">Delete user</button>
                  <button class="quiet" type="button" (click)="deleting.set(undefined); focusMore(u)">Cancel</button>
                } @else if (confirming()?.id === u.id) {
                  @if (confirming()?.action === 'reset') {
                    <span>Reset the password of {{ u.email }}? The old one stops working and they must choose a new one.</span>
                    <button class="primary" type="button" (click)="reset(u)">Yes, reset</button>
                  } @else {
                    <span>Sign out all devices of {{ u.email }}?</span>
                    <button class="danger primary" type="button" (click)="revoke(u)">Yes, sign out</button>
                  }
                  <button class="quiet" type="button" (click)="confirming.set(undefined); focusMore(u)">Cancel</button>
                } @else {
                  <app-action-menu [label]="'More actions for ' + u.email" [items]="menus().get(u.id) ?? []" />
                }
                @if (notice()[u.id]) {
                  <span class="notice" role="status">{{ notice()[u.id] }}</span>
                }
                @if (problems()[u.id]) {
                  <span class="error" role="alert">{{ problems()[u.id] }}</span>
                }
              </div>
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
      align-items: center;
      gap: 0.5rem;
    }
    td.email {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .badge {
      display: inline-block;
      margin: 0 0.25rem 0.25rem 0;
      padding: 0.1rem 0.5rem;
      border: 1px solid var(--field-line);
      border-radius: 0.35rem;
      font-size: 0.8125rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .badge.off {
      border-color: var(--danger);
      color: var(--danger);
    }
    /* on a phone each user is one compact block: address, name and state on the left, the More button on the right; a question or a
       message takes the whole width (kantahe-qzr.1). The width of the page's own box, in rem: with a larger text size the blocks come sooner */
    @container (max-width: 44rem) {
      .page {
        overflow-x: visible;
      }
      table,
      tbody,
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
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        column-gap: 0.5rem;
        padding: 0.25rem 0;
        border-bottom: 1px solid var(--line);
      }
      td {
        grid-column: 1;
        padding: 0;
        border-bottom: 0;
        overflow-wrap: anywhere;
      }
      td.email {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      td.name {
        color: var(--muted);
      }
      td.state:empty {
        display: none;
      }
      td.actions-cell {
        grid-column: 2;
        grid-row: 1 / span 3;
      }
      tr.asking td.actions-cell {
        grid-column: 1 / -1;
        grid-row: auto;
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
    this.focusQuestion(u);
  }

  /** Cancel: the question goes and the More button of the row comes back; the focus goes there. */
  protected focusMore(u: User): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(`tr[data-user="${u.id}"] button.more`)?.focus(), { injector: this.injector });
  }

  /** The More button that had the focus is replaced by the question: the focus goes to the question's first control (kantahe-qzr.2). */
  private focusQuestion(u: User): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(`tr[data-user="${u.id}"] .actions :is(input, button)`)?.focus(), { injector: this.injector });
  }

  /** A question or a message is open on the row: on a phone it takes the whole width of the row. */
  protected asking(u: User): boolean {
    return this.deleting() === u.id || this.confirming()?.id === u.id || !!this.notice()[u.id] || !!this.problems()[u.id];
  }

  /** The More menu of each user (kantahe-qzr.1); rebuilt only when a user or a pending change changes. */
  protected readonly menus = computed(() => {
    const pending = this.pending();
    return new Map(
      this.users().map((u): [string, MenuItem[]] => [
        u.id,
        [
          { label: u.admin ? 'Remove administrator' : 'Make administrator', disabled: pending.has(`${u.id}:admin`), run: () => void this.setRole(u, 'admin', !u.admin) },
          { label: u.disabled ? 'Enable' : 'Disable', disabled: pending.has(`${u.id}:disabled`), run: () => void this.setRole(u, 'disabled', !u.disabled) },
          { label: 'Reset password', run: () => this.confirm(u, 'reset') },
          { label: 'Sign out devices', danger: true, run: () => this.confirm(u, 'revoke') },
          { label: 'Delete', danger: true, run: () => this.ask(u) },
        ],
      ]),
    );
  });

  /** Changes one field of one user; the others are not sent. A change on its way makes its menu item unavailable. */
  protected async setRole(u: User, role: Role, on: boolean): Promise<void> {
    const key = `${u.id}:${role}`;
    if (this.pending().has(key)) return;
    this.startAction(u.id);
    this.pending.update((p) => new Set(p).add(key));
    try {
      const res = await this.admins.updateUser({ userId: u.id, [role]: on });
      if (res.user) this.users.update((all) => all.map((x) => (x.id === u.id ? res.user! : x)));
    } catch (e) {
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
    this.focusQuestion(u);
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
