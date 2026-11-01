import { Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../gen/kantahe/v1/auth_pb';
import { injectClient } from './core/api';
import { AuthStore } from './core/auth.store';
import { ThemeMode, ThemeService } from './core/theme';
import { ToastService } from './core/toast';
import { ToastsComponent } from './core/toasts.component';
import { NowBarComponent } from './queue/now-bar.component';

/** The frame of the ordinary pages: the title and, once signed in, the menu. The player pages have none. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NowBarComponent, ToastsComponent],
  styleUrl: './shell.component.css',
  template: `
    <div class="frame">
      <a class="skip" href="#main" (click)="skipToContent($event)">Skip to content</a>
      <div class="top">
        <a class="brand" routerLink="/library">Kantahe</a>
        <div class="tools">
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
        <nav aria-label="Main">
          <a routerLink="/library" routerLinkActive="active" ariaCurrentWhenActive="page">Library</a>
          <a routerLink="/queue" routerLinkActive="active" ariaCurrentWhenActive="page">Queue</a>
          <a routerLink="/player" routerLinkActive="active" ariaCurrentWhenActive="page">Player</a>
          <a routerLink="/me" routerLinkActive="active" ariaCurrentWhenActive="page">Me</a>
          @if (auth.user()?.uploader || auth.user()?.admin) {
            <a routerLink="/upload" routerLinkActive="active" ariaCurrentWhenActive="page">Upload</a>
          }
          @if (auth.user()?.admin) {
            <a routerLink="/admin" routerLinkActive="active" ariaCurrentWhenActive="page">Admin</a>
          }
        </nav>
        <app-now-bar />
      }
      <app-toasts [inShell]="true" />
      <router-outlet />
    </div>
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly theme = inject(ThemeService);
  private readonly client = injectClient(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private signingOut = false;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // the toasts of the app are shown here, under the menu, while the frame is on screen
    this.toasts.inShell.set(true);
    inject(DestroyRef).onDestroy(() => this.toasts.inShell.set(false));
  }

  /** The link before everything else: a keyboard or screen reader user goes past the menu to the page itself. */
  protected skipToContent(e: Event): void {
    e.preventDefault(); // a #address would be taken for a route
    const main = this.host.nativeElement.querySelector<HTMLElement>('main');
    if (!main) return;
    main.setAttribute('tabindex', '-1');
    main.focus();
  }

  protected chooseTheme(e: Event): void {
    this.theme.set((e.target as HTMLSelectElement).value as ThemeMode);
  }

  /** Signs out here whatever the server says: a user who presses Sign out must end up signed out. */
  protected async signOut(): Promise<void> {
    if (this.signingOut) return;
    this.signingOut = true;
    try {
      await this.client.logout({});
    } catch {
      this.toasts.show(
        'Signed out here. The server could not be told, so this device stays signed in there until it expires.',
        'error',
      );
    } finally {
      this.auth.signOut();
      this.signingOut = false;
      await this.router.navigateByUrl('/login');
    }
  }
}
