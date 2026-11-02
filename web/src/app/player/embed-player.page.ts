import { Component, DestroyRef, effect, inject, untracked, viewChild } from '@angular/core';
import { AuthStore } from '../core/auth.store';
import { ServerUrl, validServerUrl } from '../core/server-url';
import { PlayerViewComponent } from './player-view.component';
import { VOCALS_MAX, VOCALS_STEP, VocalsPrefs } from './vocals-prefs';

interface KantaheBridge {
  setToken(token: string, deviceId: string, serverUrl?: string): void;
  /** The app's Vocals buttons: on or off, and the level in percent (rounded to a step of 10, 0 to 100). */
  setVocals(on: boolean, pct: number): void;
}

interface HostWindow {
  kantahe?: KantaheBridge;
  /** The Flutter WebView plugin's handler bridge, when it is the one in use. */
  flutter_inappwebview?: { callHandler?: (name: string, ...args: unknown[]) => unknown };
  /** A JavaScript channel named Kantahe, when the app uses one. */
  Kantahe?: { postMessage?: (message: string) => void };
}

/**
 * /embed/player: the player for the apps' WebView. The token never travels in the address: the app
 * calls window.kantahe.setToken(token, deviceId, serverUrl) once it hears that the page is ready.
 * Until then no request is made. The page has no buttons of its own in the app, so the guide vocals are driven by
 * window.kantahe.setVocals(on, pct), and the page tells what the vocals do with the text "KantaheVocals:<state>:<pct>"
 * (state is off, loading, on or failed) on the same channels as "KantaheReady".
 */
@Component({
  selector: 'app-embed-player-page',
  imports: [PlayerViewComponent],
  template: `
    @if (auth.signedIn()) {
      <app-player-view [embedded]="true" />
    } @else {
      <p class="waiting" role="status">Waiting for the app…</p>
    }
  `,
  styles: `
    .waiting {
      padding: 2rem;
      text-align: center;
    }
  `,
})
export class EmbedPlayerPage {
  protected readonly auth = inject(AuthStore);
  private readonly serverUrl = inject(ServerUrl);
  private readonly prefs = inject(VocalsPrefs);
  private readonly view = viewChild(PlayerViewComponent);

  constructor() {
    const host = window as unknown as HostWindow;
    host.kantahe = {
      setToken: (token, deviceId, serverUrl) => this.setToken(token, deviceId, serverUrl),
      setVocals: (on, pct) => this.setVocals(on, pct),
    };
    this.reportVocals(host);
    inject(DestroyRef).onDestroy(() => delete host.kantahe);
    // the bridge exists now: tell the app, through whichever channel it has
    host.flutter_inappwebview?.callHandler?.('ready');
    host.Kantahe?.postMessage?.('KantaheReady');
  }

  /** Anything that is not a boolean and a finite number is ignored. */
  private setVocals(on: unknown, pct: unknown): void {
    if (typeof on !== 'boolean' || typeof pct !== 'number' || !Number.isFinite(pct)) return;
    this.prefs.pct.set(Math.min(VOCALS_MAX, Math.max(0, Math.round(pct / VOCALS_STEP) * VOCALS_STEP)));
    const view = this.view();
    if (view) view.setVocals(on);
    else this.prefs.on.set(on); // no player yet: the choice waits for the first song with vocals
  }

  /** Tells the app what the vocals do, once per change; what was true at the start is not news. */
  private reportVocals(host: HostWindow): void {
    const say = (state: string) => {
      const pct = this.prefs.pct();
      host.flutter_inappwebview?.callHandler?.('vocals', state, pct);
      host.Kantahe?.postMessage?.(`KantaheVocals:${state}:${pct}`);
    };
    let failures = this.prefs.failures();
    // a failure is told before the "off" that follows it
    effect(() => {
      const n = this.prefs.failures();
      if (n === failures) return;
      failures = n;
      untracked(() => say('failed'));
    });
    let last = `${this.prefs.state()}:${this.prefs.pct()}`;
    effect(() => {
      const now = `${this.prefs.state()}:${this.prefs.pct()}`;
      if (now === last) return;
      last = now;
      untracked(() => say(this.prefs.state()));
    });
  }

  private setToken(token: string, deviceId: string, serverUrl?: string): void {
    if (typeof token !== 'string' || token.trim() === '' || typeof deviceId !== 'string' || deviceId.trim() === '') return;
    if (serverUrl && validServerUrl(serverUrl)) this.serverUrl.set(serverUrl);
    this.auth.setSession(token, deviceId);
  }
}
