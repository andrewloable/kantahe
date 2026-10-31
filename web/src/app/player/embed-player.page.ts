import { Component, DestroyRef, inject } from '@angular/core';
import { AuthStore } from '../core/auth.store';
import { ServerUrl, validServerUrl } from '../core/server-url';
import { PlayerViewComponent } from './player-view.component';

interface KantaheBridge {
  setToken(token: string, deviceId: string, serverUrl?: string): void;
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
 * Until then no request is made.
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

  constructor() {
    const host = window as unknown as HostWindow;
    host.kantahe = { setToken: (token, deviceId, serverUrl) => this.setToken(token, deviceId, serverUrl) };
    inject(DestroyRef).onDestroy(() => delete host.kantahe);
    // the bridge exists now: tell the app, through whichever channel it has
    host.flutter_inappwebview?.callHandler?.('ready');
    host.Kantahe?.postMessage?.('KantaheReady');
  }

  private setToken(token: string, deviceId: string, serverUrl?: string): void {
    if (typeof token !== 'string' || token.trim() === '' || typeof deviceId !== 'string' || deviceId.trim() === '') return;
    if (serverUrl && validServerUrl(serverUrl)) this.serverUrl.set(serverUrl);
    this.auth.setSession(token, deviceId);
  }
}
