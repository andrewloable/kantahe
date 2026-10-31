import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Code, ConnectError } from '@connectrpc/connect';
import { AdminService } from '../../../gen/kantahe/v1/admin_pb';
import { User } from '../../../gen/kantahe/v1/common_pb';
import { injectClient } from '../../core/api';
import { fromServer, problem } from '../../core/errors';
import { ToastService } from '../../core/toast';
import { CreatedUser, UserFormComponent } from './user-form.component';
import { generateTempPassword } from './temp-password';
import { TempPasswordPanelComponent } from './temp-password-panel.component';

type Role = 'admin' | 'uploader' | 'disabled';

@Component({
  selector: 'app-users-page',
  imports: [UserFormComponent, TempPasswordPanelComponent],
  template: `
    <h2>Users</h2>
    @if (shown(); as s) {
      <app-temp-password-panel [email]="s.email" [password]="s.password" (closed)="shown.set(undefined)" />
    }
    @if (loadError()) {
      <p class="error" role="alert">{{ loadError() }} <button type="button" (click)="load()">Try again</button></p>
    }
    <table>
      <thead>
        <tr>
          <th scope="col">Email</th>
          <th scope="col">Name</th>
          <th scope="col">Admin</th>
          <th scope="col">Uploader</th>
          <th scope="col">Disabled</th>
          <th scope="col">Account</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        @for (u of users(); track u.id) {
          <tr>
            <td>{{ u.email }}</td>
            <td>{{ u.displayName }}</td>
            <td><input type="checkbox" data-role="admin" [attr.aria-label]="'Admin: ' + u.email" [checked]="u.admin" [disabled]="pending().has(u.id + ':admin')" (change)="toggle(u, 'admin', $event)" /></td>
            <td><input type="checkbox" data-role="uploader" [attr.aria-label]="'Uploader: ' + u.email" [checked]="u.uploader" [disabled]="pending().has(u.id + ':uploader')" (change)="toggle(u, 'uploader', $event)" /></td>
            <td><input type="checkbox" data-role="disabled" [attr.aria-label]="'Disabled: ' + u.email" [checked]="u.disabled" [disabled]="pending().has(u.id + ':disabled')" (change)="toggle(u, 'disabled', $event)" /></td>
            <td>{{ u.mustChangePassword ? 'must change password' : '' }}</td>
            <td class="actions">
              @if (deleting() === u.id) {
                <label [for]="'confirm-' + u.id">Type {{ u.email }} to delete this user</label>
                <input [id]="'confirm-' + u.id" type="text" autocomplete="off" [value]="typed()" (input)="typed.set(value($event))" />
                <button type="button" [disabled]="typed() !== u.email" (click)="remove(u)">Delete user</button>
                <button type="button" (click)="deleting.set(undefined)">Cancel</button>
              } @else if (confirming()?.id === u.id) {
                @if (confirming()?.action === 'reset') {
                  <span>Reset the password of {{ u.email }}? The old one stops working and they must choose a new one.</span>
                  <button type="button" (click)="reset(u)">Yes, reset</button>
                } @else {
                  <span>Sign out all devices of {{ u.email }}?</span>
                  <button type="button" (click)="revoke(u)">Yes, sign out</button>
                }
                <button type="button" (click)="confirming.set(undefined)">Cancel</button>
              } @else {
                <button type="button" [attr.aria-label]="'Reset password of ' + u.email" (click)="confirm(u, 'reset')">Reset password</button>
                <button type="button" [attr.aria-label]="'Sign out devices of ' + u.email" (click)="confirm(u, 'revoke')">Sign out devices</button>
                <button type="button" [attr.aria-label]="'Delete ' + u.email" (click)="ask(u)">Delete</button>
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
    <app-user-form (created)="created($event)" />
  `,
  styles: `
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
    input[type='checkbox'] {
      width: 1.5rem;
      height: 1.5rem;
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
