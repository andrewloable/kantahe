import { Component, computed, ElementRef, output, signal, viewChild } from '@angular/core';
import { Code } from '@connectrpc/connect';
import { AdminService } from '../../../gen/kantahe/v1/admin_pb';
import { User } from '../../../gen/kantahe/v1/common_pb';
import { fromServer, problem } from '../../core/errors';
import { injectClient } from '../../core/api';
import { Errors, fieldValue, passwordLengthOk, validEmail } from '../../auth/form';
import { generateTempPassword } from './temp-password';

export interface CreatedUser {
  user: User;
  /** The temporary password the administrator chose or generated; shown once. */
  password: string;
}

@Component({
  selector: 'app-user-form',
  template: `
    <h2>New user</h2>
    <form (submit)="submit($event)" novalidate>
      <div class="field">
        <label for="new-email">Email</label>
        <input #email id="new-email" type="email" autocomplete="off" [value]="emailValue()" (input)="emailValue.set(value($event))" [attr.aria-invalid]="errors().email ? true : null" />
        @if (errors().email) {
          <p class="error" role="alert">{{ errors().email }}</p>
        }
      </div>
      <div class="field">
        <label for="new-name">Name</label>
        <input id="new-name" type="text" autocomplete="off" [value]="name()" (input)="name.set(value($event))" [attr.aria-invalid]="errors().name ? true : null" />
        @if (errors().name) {
          <p class="error" role="alert">{{ errors().name }}</p>
        }
      </div>
      <div class="field">
        <label for="new-password">Temporary password</label>
        <input #password id="new-password" type="text" autocomplete="off" spellcheck="false" [value]="temp()" (input)="temp.set(value($event))" [attr.aria-invalid]="errors().password ? true : null" />
        <button type="button" (click)="generate()">Generate</button>
        @if (errors().password) {
          <p class="error" role="alert">{{ errors().password }}</p>
        }
      </div>
      <div class="roles">
        <input id="new-admin" type="checkbox" [checked]="admin()" (change)="admin.set(checked($event))" />
        <label for="new-admin">Administrator</label>
        <input id="new-uploader" type="checkbox" [checked]="uploader()" (change)="uploader.set(checked($event))" />
        <label for="new-uploader">May upload songs</label>
      </div>
      @if (failure()) {
        <p class="error" role="alert">{{ failure() }}</p>
      }
      <button type="submit" [disabled]="busy()">Create user</button>
    </form>
  `,
  styles: `
    .roles {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .roles label {
      display: inline;
      margin: 0 1rem 0 0;
    }
  `,
})
export class UserFormComponent {
  private readonly admins = injectClient(AdminService);

  readonly created = output<CreatedUser>();

  protected readonly emailValue = signal('');
  protected readonly name = signal('');
  protected readonly temp = signal('');
  protected readonly admin = signal(false);
  protected readonly uploader = signal(false);
  protected readonly busy = signal(false);
  protected readonly failure = signal('');
  private readonly submitted = signal(false);
  private readonly emailBox = viewChild<ElementRef<HTMLInputElement>>('email');
  private readonly passwordBox = viewChild<ElementRef<HTMLInputElement>>('password');

  protected readonly value = fieldValue;
  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected readonly errors = computed(() => {
    const out: Errors<'email' | 'name' | 'password'> = {};
    if (!this.submitted()) return out;
    if (!validEmail(this.emailValue())) out.email = 'Enter a valid email address.';
    const n = this.name().trim();
    if (n.length < 1 || [...n].length > 100) out.name = 'Enter a name (1 to 100 characters).';
    if (!passwordLengthOk(this.temp())) out.password = 'The temporary password must be 8 to 256 characters.';
    return out;
  });

  protected generate(): void {
    this.temp.set(generateTempPassword());
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.submitted.set(true);
    this.failure.set('');
    if (Object.keys(this.errors()).length > 0) return;
    this.busy.set(true);
    const password = this.temp();
    try {
      const res = await this.admins.createUser({
        email: this.emailValue().trim(),
        displayName: this.name().trim(),
        temporaryPassword: password,
        admin: this.admin(),
        uploader: this.uploader(),
      });
      if (res.user) this.created.emit({ user: res.user, password });
      this.clear();
    } catch (e) {
      this.failure.set(problem(e, { [Code.AlreadyExists]: 'Email already in use', [Code.InvalidArgument]: fromServer }));
    } finally {
      this.busy.set(false);
    }
  }

  private clear(): void {
    this.emailValue.set('');
    this.name.set('');
    this.temp.set('');
    this.admin.set(false);
    this.uploader.set(false);
    this.submitted.set(false);
    // the boxes may not have been redrawn since the last key
    const e = this.emailBox()?.nativeElement;
    const p = this.passwordBox()?.nativeElement;
    if (e) e.value = '';
    if (p) p.value = '';
  }
}
