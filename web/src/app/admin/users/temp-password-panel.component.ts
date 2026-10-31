import { Component, input, output, signal } from '@angular/core';

let nextId = 1;

/** A temporary password shown once to the administrator, to be passed on to the user. */
@Component({
  selector: 'app-temp-password-panel',
  template: `
    <section class="panel" aria-label="Temporary password">
      <label [for]="id">Temporary password for {{ email() }}</label>
      <input [id]="id" type="text" readonly autocomplete="off" [value]="password()" (focus)="select($event)" />
      <p>This password is shown only now. Give it to the user; they must change it when they first sign in.</p>
      <button type="button" (click)="copy()">Copy</button>
      <button type="button" (click)="closed.emit()">Close</button>
      <p role="status">{{ message() }}</p>
    </section>
  `,
  styles: `
    .panel {
      margin: 1rem 0;
      padding: 1rem;
      border: 2px solid var(--sung);
      border-radius: 0.5rem;
    }
    input {
      width: 100%;
      margin-bottom: 0.5rem;
      font-family: ui-monospace, monospace;
      font-size: 1.25rem;
    }
  `,
})
export class TempPasswordPanelComponent {
  readonly email = input.required<string>();
  readonly password = input.required<string>();
  readonly closed = output<void>();

  protected readonly id = `temp-password-${nextId++}`;
  protected readonly message = signal('');

  protected select(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.password());
      this.message.set('Copied.');
    } catch {
      this.message.set('Select the password and copy it.');
    }
  }
}
