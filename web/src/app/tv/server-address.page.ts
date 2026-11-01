import { afterNextRender, Component, DestroyRef, ElementRef, inject, Injector, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { createClient } from '@connectrpc/connect';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { fieldValue } from '../auth/form';
import { AuthStore } from '../core/auth.store';
import { normalizeServerUrl, ServerUrl } from '../core/server-url';
import { FIND_SERVERS, FoundServer, SERVER_PROBE } from './server-sweep';

/** How long the server has to answer; tests replace the transport. */
const ANSWER_WITHIN_MS = 5000;

const SETUP_TEXT = 'This server has no account yet. Open it in a web browser to set it up, then connect again.';

/**
 * First screen of a TV app: where is the server? It looks for Kantahe servers on the network (docs/PLAN.md section 8,
 * "Finding the server"): one is connected to by itself, several are listed, and only when none is found does it ask for
 * the address. A server that has no account yet is set up in a browser.
 */
@Component({
  selector: 'app-server-address-page',
  template: `
    <main class="card">
      @switch (phase()) {
        @case ('searching') {
          <h1>Connect to your server</h1>
          <p role="status">Looking for Kantahe servers on this network...@if (total()) { {{ done() }} of {{ total() }} }</p>
        }
        @case ('connecting') {
          <h1>Connect to your server</h1>
          <p role="status">Connecting to {{ connectingTo() }}...</p>
        }
        @case ('list') {
          <h1>Choose your server</h1>
          <ul class="servers">
            @for (s of found(); track s.url) {
              <li>
                <button type="button" class="server" [attr.data-server]="s.url" (click)="choose(s)">
                  <strong>{{ s.name || s.url }}</strong>
                  <span>{{ s.url }}@if (s.version) { · version {{ s.version }} }</span>
                </button>
              </li>
            }
          </ul>
          @if (failure()) {
            <p class="error" role="alert">{{ failure() }}</p>
          }
          <button type="button" (click)="search(false)">Search again</button>
        }
        @case ('manual') {
          <h1>Connect to your server</h1>
          @if (more()) {
            <p>
              No Kantahe server was found on this network yet. Search again looks at more addresses, or enter its address, for example
              http://192.168.1.20:8080.
            </p>
          } @else {
            <p>No Kantahe server was found on this network. Enter its address, for example http://192.168.1.20:8080.</p>
          }
          <form (submit)="submit($event)" novalidate>
            <div class="field">
              <label for="server">Server address</label>
              <input id="server" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" [value]="text()" (input)="text.set(value($event))" />
            </div>
            @if (failure()) {
              <p class="error" role="alert">{{ failure() }}</p>
            }
            <button type="submit" [disabled]="busy()">Connect</button>
          </form>
          <p><button type="button" (click)="search(true)">Search again</button></p>
        }
      }
    </main>
  `,
  styles: `
    .servers {
      list-style: none;
      margin: 0 0 1rem;
      padding: 0;
    }
    .server {
      display: block;
      width: 100%;
      margin-bottom: 0.5rem;
      text-align: left;
    }
    .server span {
      display: block;
      opacity: 0.8;
    }
  `,
})
export class ServerAddressPage {
  private readonly probe = inject(SERVER_PROBE);
  private readonly findServers = inject(FIND_SERVERS);
  private readonly server = inject(ServerUrl);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private searching = false;
  private gone = false;

  protected readonly phase = signal<'searching' | 'connecting' | 'list' | 'manual'>('searching');
  protected readonly found = signal<FoundServer[]>([]);
  protected readonly more = signal(false);
  protected readonly connectingTo = signal('');
  protected readonly done = signal(0);
  protected readonly total = signal(0);
  protected readonly text = signal('http://');
  protected readonly busy = signal(false);
  protected readonly failure = signal('');
  protected readonly value = fieldValue;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.gone = true));
    void this.search(false);
  }

  /** Looks for servers, then decides by what was found. [next]: the batch of addresses after the last one, not a new search. */
  protected async search(next: boolean): Promise<void> {
    if (this.searching) return;
    this.searching = true;
    this.failure.set('');
    this.done.set(0);
    this.total.set(0);
    this.phase.set('searching');
    let servers: FoundServer[] = [];
    let more = false;
    try {
      ({ servers, more } = await this.findServers({
        next,
        progress: (done, total) => {
          this.done.set(done);
          this.total.set(total);
        },
      }));
    } catch {
      // a search that fails finds nothing: the address can still be typed
    } finally {
      this.searching = false;
    }
    if (this.gone) return;
    if (servers.length === 1 && !servers[0].setupRequired && this.server.autoConnect()) {
      this.connectingTo.set(servers[0].name || servers[0].url);
      this.phase.set('connecting');
      await this.adopt(servers[0].url);
      return;
    }
    this.found.set(servers);
    this.more.set(more);
    this.phase.set(servers.length ? 'list' : 'manual');
    // the remote starts on the first server, or in the field: the first thing to do here is to choose or to type
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('button[data-server], #server')?.focus(), { injector: this.injector });
  }

  protected async choose(server: FoundServer): Promise<void> {
    if (server.setupRequired) {
      this.failure.set(SETUP_TEXT);
      return;
    }
    await this.adopt(server.url);
  }

  /** Keeps the address and goes on to sign-in. A token belongs to one server: a different address ends the session. */
  private async adopt(url: string): Promise<void> {
    const previous = this.server.hasAddress() ? this.server.base() : undefined;
    this.server.set(url);
    if (previous !== undefined && previous !== url) this.auth.signOut();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    await this.router.navigateByUrl(returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login', { replaceUrl: true });
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
        this.failure.set(SETUP_TEXT);
        return;
      }
      await this.adopt(url);
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
