import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, inject, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, take } from 'rxjs';
import { ScoreNotifier } from './core/score-notifier';
import { removeSplash } from './core/splash';
import { StateStore } from './core/state.store';
import { ToastsComponent } from './core/toasts.component';

@Component({
  imports: [RouterOutlet, ToastsComponent],
  selector: 'app-root',
  template: `
    <router-outlet />
    <app-toasts />
  `,
})
export class App {
  // created here so the live state follows the sign-in for the whole app
  protected readonly state = inject(StateStore);
  // and the scores of songs sung on another device show up as toasts
  protected readonly scores = inject(ScoreNotifier);

  constructor() {
    // the splash of index.html stays until the first page is on screen: the first navigation (to whatever page it ends on, /login, /setup,
    // /player and /embed/player included) has ended and Angular has rendered it. Later navigations do nothing.
    const doc = inject(DOCUMENT);
    const injector = inject(Injector);
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        take(1),
        takeUntilDestroyed(),
      )
      .subscribe(() => afterNextRender(() => removeSplash(doc), { injector }));
  }
}
