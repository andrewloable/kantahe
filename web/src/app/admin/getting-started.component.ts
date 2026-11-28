import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../gen/kantahe/v1/admin_pb';
import { CatalogService } from '../../gen/kantahe/v1/catalog_pb';
import { injectClient } from '../core/api';
import { StateStore } from '../core/state.store';
import { readStore, writeStore } from '../core/storage';

const HIDDEN = 'kantahe.admin.gettingStarted.hidden';
const COMPLETE = 'kantahe.admin.gettingStarted.complete';
const PLAYED = 'kantahe.admin.gettingStarted.played';

/**
 * The first steps of a new server, at the top of Administration (kantahe-qzr.7): add songs, add the singers, open the Player. It is drawn
 * at once (each step says Checking… until its answer comes) and is only left out on a later visit, so that it never moves the page after
 * the first paint; Hide puts it away for good, and so does a visit after every step is done.
 */
@Component({
  selector: 'app-getting-started',
  imports: [RouterLink],
  template: `
    @if (shown()) {
      <section class="getting-started" aria-labelledby="getting-started-title">
        <div class="head">
          <h2 id="getting-started-title">Getting started</h2>
          <button type="button" class="quiet" (click)="hide()">Hide</button>
        </div>
        @if (allDone()) {
          <p>Everything is set up. Enjoy the singing!</p>
        }
        <ol>
          @for (s of steps(); track s.link) {
            <li [class.done]="s.done === true">
              <!-- the mark shows the state by its shape (the step's number, … while checking, ✓ when done); the word is for screen readers -->
              <span class="mark" aria-hidden="true">{{ s.done === true ? '✓' : s.done === undefined ? '…' : $index + 1 }}</span>
              <a data-inline-link [routerLink]="s.link">{{ s.label }}</a>
              <span class="state">{{ s.done === undefined ? 'Checking…' : s.done ? 'Done' : 'To do' }}</span>
            </li>
          }
        </ol>
      </section>
    }
  `,
  styles: `
    .getting-started {
      margin: 0 0 1rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--line);
      border-radius: 0.75rem;
      background: var(--panel);
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    h2 {
      margin: 0;
      font-size: 1.125rem;
    }
    ol {
      margin: 0.5rem 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.5rem;
    }
    /* one line per step whatever its state is: only the mark changes, and it has a size of its own */
    li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 2.75rem;
    }
    /* the number of a step, … while it is checked, a check mark when it is done */
    .mark {
      flex: none;
      display: inline-grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      border: 2px solid var(--accent);
      border-radius: 50%;
      color: var(--accent);
      font-weight: 700;
    }
    li.done .mark {
      background: var(--accent);
      color: var(--on-accent);
    }
    a {
      display: inline-flex;
      align-items: center;
      min-height: 2.75rem;
      flex: 1 1 auto;
      min-width: 0;
    }
    /* said, not shown: the mark shows it (a word changing width made the line wrap and the page move) */
    .state {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    p {
      margin: 0.5rem 0 0;
    }
  `,
})
export class GettingStartedComponent {
  private readonly admins = injectClient(AdminService);
  private readonly catalog = injectClient(CatalogService);
  private readonly state = inject(StateStore).state;

  private readonly hidden = signal(readStore(HIDDEN) === '1');
  /** Read once: a visit after every step was done does not draw it (drawing then removing it would move the page). */
  private readonly completeBefore = readStore(COMPLETE) === '1';
  protected readonly shown = computed(() => !this.hidden() && !this.completeBefore);

  private readonly hasSongs = signal<boolean | undefined>(undefined);
  private readonly hasSingers = signal<boolean | undefined>(undefined);
  /** A device of this administrator has been the player: now, or before (remembered on this browser; a hint, not a check). */
  private readonly played = computed(() => !!this.state()?.playerDeviceId || readStore(PLAYED) === '1');

  protected readonly steps = computed(() => [
    { label: 'Add songs', link: '/admin/upload', done: this.hasSongs() },
    { label: 'Add the singers as users', link: '/admin/users', done: this.hasSingers() },
    { label: 'Open the Player on the TV or a laptop and press Play here', link: '/player', done: this.played() as boolean | undefined },
  ]);
  protected readonly allDone = computed(() => this.steps().every((s) => s.done === true));

  constructor() {
    if (this.shown()) {
      this.catalog
        .searchSongs({ pageSize: 1 })
        .then((r) => this.hasSongs.set(r.songs.length > 0))
        .catch(() => this.hasSongs.set(false));
      this.admins
        .listUsers({})
        .then((r) => this.hasSingers.set(r.users.length > 1))
        .catch(() => this.hasSingers.set(false));
    }
    effect(() => {
      if (this.state()?.playerDeviceId) writeStore(PLAYED, '1');
    });
    effect(() => {
      if (this.allDone()) writeStore(COMPLETE, '1');
    });
  }

  protected hide(): void {
    writeStore(HIDDEN, '1');
    this.hidden.set(true);
  }
}
