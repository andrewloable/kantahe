import { Component, inject } from '@angular/core';
import { AuthStore } from '../core/auth.store';
import { KeyboardShortcuts } from '../core/shortcuts';
import { SignOut } from '../core/sign-out';
import { ThemeMode, ThemeService } from '../core/theme';

const THEMES: { value: ThemeMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto (system)', hint: 'Follows the setting of this device.' },
  { value: 'light', label: 'Light', hint: '' },
  { value: 'dark', label: 'Dark', hint: '' },
];

/** Me > Appearance and account: the theme of this browser and the account it is signed in with (on a phone the top bar has neither). */
@Component({
  selector: 'app-appearance',
  template: `
    <h2>Appearance</h2>
    <fieldset>
      <legend>Theme</legend>
      @for (t of themes; track t.value) {
        <div class="option">
          <input type="radio" name="theme" [id]="'theme-' + t.value" [value]="t.value" [checked]="theme.mode() === t.value" (change)="theme.set(t.value)" />
          <label [for]="'theme-' + t.value">{{ t.label }}</label>
          @if (t.hint) {
            <span class="hint">{{ t.hint }}</span>
          }
        </div>
      }
      <p class="hint">Kept in this browser. The player is always dark.</p>
    </fieldset>
    <h2>Keyboard</h2>
    <div class="option">
      <input type="checkbox" id="shortcuts" [checked]="shortcuts.enabled()" (change)="toggleShortcuts($event)" />
      <label for="shortcuts">Keyboard shortcuts</label>
      <span class="hint">Single keys on the player and in the Library (press ? to see them). Off: no key does anything by itself.</span>
    </div>
    <h2>Account</h2>
    <p>Signed in as <strong>{{ auth.user()?.email }}</strong>.</p>
    <button type="button" (click)="signOut.run()">Sign out</button>
  `,
  styles: `
    fieldset {
      margin: 0 0 1.5rem;
      border: 1px solid var(--line);
      border-radius: 0.5rem;
    }
    .option {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0;
    }
    .option label {
      display: inline-flex;
      align-items: center;
      min-height: 2.75rem;
      margin: 0;
    }
    .hint {
      color: var(--muted);
      font-size: 0.875rem;
    }
    strong {
      overflow-wrap: anywhere;
    }
  `,
})
export class AppearanceComponent {
  protected readonly themes = THEMES;
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthStore);
  protected readonly signOut = inject(SignOut);
  protected readonly shortcuts = inject(KeyboardShortcuts);

  protected toggleShortcuts(e: Event): void {
    this.shortcuts.setEnabled((e.target as HTMLInputElement).checked);
  }
}
