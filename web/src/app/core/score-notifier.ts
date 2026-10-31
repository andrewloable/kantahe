import { effect, inject, Injectable, untracked } from '@angular/core';
import { AuthStore } from './auth.store';
import { StateStore } from './state.store';
import { ToastService } from './toast';

/**
 * A device that is not the player shows the score of a song as a toast (the player shows the full
 * screen with the fanfare). Created once at the root of the app, so it works on every page.
 */
@Injectable({ providedIn: 'root' })
export class ScoreNotifier {
  private readonly store = inject(StateStore);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private last?: string;

  constructor() {
    effect(() => {
      const state = this.store.state();
      const score = state?.score;
      const isPlayer = !!this.auth.deviceId() && state?.playerDeviceId === this.auth.deviceId();
      untracked(() => {
        if (!score) {
          this.last = undefined;
          return;
        }
        const key = `${score.number}:${score.untilMs}`;
        if (key === this.last) return;
        this.last = key;
        if (!isPlayer) this.toast.show(score.hasValue ? `Score ${score.value}` : 'No score this time');
      });
    });
  }
}
