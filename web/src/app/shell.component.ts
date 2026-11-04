import { Component, computed, DestroyRef, ElementRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from './core/auth.store';
import { InstallPrompt } from './core/install';
import { KeyboardShortcuts } from './core/shortcuts';
import { COPYRIGHT, ServerVersion } from './core/server-version';
import { SignOut } from './core/sign-out';
import { ThemeMode, ThemeService } from './core/theme';
import { ToastService } from './core/toast';
import { ToastsComponent } from './core/toasts.component';
import { NowBarComponent } from './queue/now-bar.component';
import { InstallGuideDialogComponent } from './shared/install-guide-dialog.component';
import { ShortcutsDialogComponent } from './shared/shortcuts-dialog.component';

/** The main destinations: Admin only for administrators (Upload is its first page). Icons are 24x24 outline paths, drawn with a stroke. */
const TABS = [
  { path: '/library', label: 'Library', icon: 'M4 5h4v14H4zM10 5h4v14h-4zM16.5 5.5l3.8 1-3.4 13.5-3.8-1z' },
  { path: '/queue', label: 'Queue', icon: 'M4 6h16M4 12h16M4 18h10M17 15v6l4-3z' },
  { path: '/player', label: 'Player', icon: 'M7 4.5v15L19.5 12z' },
  { path: '/me', label: 'Me', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-4 3.6-6 8-6s8 2 8 6' },
];
const ADMIN_TAB = { path: '/admin', label: 'Admin', icon: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM9 12l2 2 4-4' };

/** The frame of the ordinary pages: the title and, once signed in, the menu. The player pages have none. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NowBarComponent, ToastsComponent, ShortcutsDialogComponent, InstallGuideDialogComponent],
  host: { '(document:keydown)': 'onKey($event)' },
  styleUrl: './shell.component.css',
  template: `
    <div class="frame">
      <a class="skip" href="#main" (click)="skipToContent($event)">Skip to content</a>
      <header>
        <div class="top">
          <a class="brand" routerLink="/library">Kantahe</a>
          <!-- on a phone, once signed in, these live under Me > Appearance and account (shell.component.css) -->
          <div class="tools" [class.signed-in]="auth.signedIn()">
            <select class="theme" aria-label="Theme" [value]="theme.mode()" (change)="chooseTheme($event)">
              <option value="auto">Auto (system)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            @if (auth.signedIn()) {
              <button type="button" class="signout" (click)="signOut()">Sign out</button>
            }
          </div>
        </div>
        @if (auth.signedIn()) {
          <!-- a row of tabs at the top; on a phone a tab bar at the bottom (shell.component.css) -->
          <nav aria-label="Main">
            @for (tab of tabs(); track tab.path) {
              <a [routerLink]="tab.path" routerLinkActive="active" ariaCurrentWhenActive="page">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path [attr.d]="tab.icon" /></svg>
                <span class="label">{{ tab.label }}</span>
              </a>
            }
          </nav>
        }
      </header>
      @if (auth.signedIn() && install.showBanner()) {
        <aside class="install" aria-label="Install Kantahe">
          <span>Install Kantahe on this {{ install.device() }}</span>
          <span class="actions">
            <button type="button" class="primary" (click)="install.install()">{{ install.kind() === 'ios' ? 'How to' : 'Install' }}</button>
            <button type="button" class="quiet" (click)="install.dismiss()">Not now</button>
          </span>
        </aside>
      }
      @if (auth.signedIn()) {
        <app-now-bar />
      }
      <!-- the one main landmark: the skip link's target; pages inside the frame have no main of their own -->
      <main id="main" tabindex="-1">
        <app-toasts [inShell]="true" />
        <router-outlet />
      </main>
      <footer class="legal">{{ copyright }} · Kantahe{{ serverVersion.version() ? ' ' + serverVersion.version() : '' }}</footer>
      <app-shortcuts-dialog />
      <app-install-guide-dialog />
    </div>
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly tabs = computed(() => (this.auth.user()?.admin ? [...TABS, ADMIN_TAB] : TABS));
  protected readonly theme = inject(ThemeService);
  private readonly toasts = inject(ToastService);
  private readonly signOutAction = inject(SignOut);
  private readonly shortcuts = inject(KeyboardShortcuts);
  protected readonly install = inject(InstallPrompt);
  protected readonly serverVersion = inject(ServerVersion);
  protected readonly copyright = COPYRIGHT;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // the toasts of the app are shown here, under the menu, while the frame is on screen
    void this.serverVersion.load();
    this.toasts.inShell.set(true);
    inject(DestroyRef).onDestroy(() => this.toasts.inShell.set(false));
  }

  /** The link before everything else: a keyboard or screen reader user goes past the menu to the page itself. */
  protected skipToContent(e: Event): void {
    e.preventDefault(); // a #address would be taken for a route
    this.host.nativeElement.querySelector<HTMLElement>('main#main')?.focus();
  }

  /** ? shows the list of keyboard shortcuts (the shortcuts themselves are on the pages they belong to). */
  protected onKey(e: KeyboardEvent): void {
    if (e.key === '?' && this.shortcuts.accepts(e)) {
      e.preventDefault();
      this.shortcuts.helpOpen.set(true);
    }
  }

  protected chooseTheme(e: Event): void {
    this.theme.set((e.target as HTMLSelectElement).value as ThemeMode);
  }

  protected signOut(): Promise<void> {
    return this.signOutAction.run();
  }
}
