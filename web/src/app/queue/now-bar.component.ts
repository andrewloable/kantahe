import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { whereText } from './now-playing.component';

/** A slim line under the menu on every page but the queue: what plays, where, and how many songs wait. */
@Component({
  selector: 'app-now-bar',
  imports: [RouterLink],
  template: `
    @if (shown()) {
      <aside class="nowbar" aria-label="Now playing">
        <a routerLink="/queue">
          <span class="song">
            @if (song(); as s) {
              <strong>{{ s.title }}</strong> — {{ s.artist }}
            } @else {
              Nothing is playing
            }
          </span>
          <span class="where">{{ where() }} · {{ coming() }} coming up</span>
        </a>
      </aside>
    }
  `,
  styles: `
    .nowbar {
      display: block;
      margin: 0.5rem 1rem 0;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 0.5rem;
    }
    .nowbar a {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 2.75rem;
      padding: 0.25rem 0.75rem;
      color: var(--text);
      text-decoration: none;
    }
    .song,
    .where {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .where {
      color: var(--muted);
      font-size: 0.875rem;
    }
  `,
})
export class NowBarComponent {
  private readonly state = inject(StateStore).state;
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly song = computed(() => this.state()?.now?.song);
  protected readonly coming = computed(() => this.state()?.queue.length ?? 0);
  protected readonly where = computed(() => whereText(this.state(), this.auth.deviceId()));
  protected readonly shown = computed(() => !!this.state() && (!!this.song() || this.coming() > 0) && !this.url().startsWith('/queue'));
}
