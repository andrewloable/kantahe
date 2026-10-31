import { afterNextRender, Component, ElementRef, inject, InjectionToken, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { createClient, Transport } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { fieldValue } from '../auth/form';
import { AuthStore } from '../core/auth.store';
import { normalizeServerUrl, ServerUrl } from '../core/server-url';

/** How long the server has to answer; tests replace the transport. */
const ANSWER_WITHIN_MS = 5000;

/** The transport that asks a server we are not yet configured for. */
export const SERVER_PROBE = new InjectionToken<(baseUrl: string) => Transport>('kantahe server probe', {
  providedIn: 'root',
  factory: () => (baseUrl) => createConnectTransport({ baseUrl, useBinaryFormat: false }),
});

/** First screen of a TV app: where is the server? A server that has no account yet is set up in a browser. */
@Component({
  selector: 'app-server-address-page',
  template: `
    <main class="card">
      <h1>Connect to your server</h1>
      <p>Enter the address of your Kantahe server, for example http://192.168.1.20:8080.</p>
      <form (submit)="submit($event)" novalidate>
        <div class="field">
          <label for="server">Server address</label>
          <input #address id="server" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" [value]="text()" (input)="text.set(value($event))" />
        </div>
        @if (failure()) {
          <p class="error" role="alert">{{ failure() }}</p>
        }
        <button type="submit" [disabled]="busy()">Connect</button>
      </form>
    </main>
  `,
})
export class ServerAddressPage {
  private readonly probe = inject(SERVER_PROBE);
  private readonly server = inject(ServerUrl);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('address');

  protected readonly text = signal('http://');
  protected readonly busy = signal(false);
  protected readonly failure = signal('');
  protected readonly value = fieldValue;

  constructor() {
    // the remote starts in the field: the first thing to do here is to type
    afterNextRender(() => this.input().nativeElement.focus());
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.failure.set('');
    const url = normalizeServerUrl(this.text());
    if (!url) {
      this.failure.set('Enter an address such as http://192.168.1.20:8080');
      return;
    }
    this.busy.set(true);
    const abort = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, ANSWER_WITHIN_MS);
    try {
      const info = await createClient(AuthService, this.probe(url)).getServerInfo({}, { signal: abort.signal });
      if (info.setupRequired) {
        this.failure.set('This server has no account yet. Open it in a web browser to set it up, then connect again.');
        return;
      }
      // a token belongs to one server: a different address ends the session
      const previous = this.server.hasAddress() ? this.server.base() : undefined;
      this.server.set(url);
      if (previous !== undefined && previous !== url) this.auth.signOut();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login', { replaceUrl: true });
    } catch {
      this.failure.set(
        timedOut
          ? `The server at ${url} did not answer within 5 seconds. Check the address and the network.`
          : `Could not reach the server at ${url}. Check the address and that this device is on the same network.`,
      );
    } finally {
      clearTimeout(timer);
      this.busy.set(false);
    }
  }
}
