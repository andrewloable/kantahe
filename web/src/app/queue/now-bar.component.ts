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
            @if (!state()) {
              Connecting…
            } @else if (song(); as s) {
              <strong>{{ s.title }}</strong> — {{ s.artist }}
            } @else {
              Nothing is playing
            }
          </span>
          @if (state()) {
            <!-- on a phone one line: the song and the count; where it plays is said to screen readers (kantahe-cqc.3) -->
            <span class="meta"><span class="where">{{ where() }} · </span>{{ coming() }} coming up</span>
          }
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
    /* drawn from the first paint, at the same height before and after the state arrives, so the page never moves (kantahe-cqc.3) */
    .nowbar a {
      display: flex;
      flex-direction: column;
      justify-content: center;
      /* two lines of text (the song, the meta line) fit: the box keeps its height when the second line arrives */
      min-height: 3.375rem;
      padding: 0.25rem 0.75rem;
      color: var(--text);
      text-decoration: none;
    }
    .song,
    .meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      color: var(--muted);
      font-size: 0.875rem;
    }
    @media (max-width: 40rem) {
      .nowbar a {
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
        min-height: 2.75rem;
      }
      .song {
        flex: 1 1 auto;
        min-width: 0;
      }
      .meta {
        flex: none;
      }
      .where {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
    }
  `,
})
export class NowBarComponent {
  protected readonly state = inject(StateStore).state;
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
  /** On every page of a signed-in user but the Queue (which shows all of it), from the first paint: Connecting… until the state comes. */
  protected readonly shown = computed(() => !!this.auth.token() && !this.url().startsWith('/queue'));
}
