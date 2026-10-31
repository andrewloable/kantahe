import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ScoreNotifier } from './core/score-notifier';
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
}
