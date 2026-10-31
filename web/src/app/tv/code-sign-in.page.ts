import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuthService, StartCodeLoginResponse } from '../../gen/kantahe/v1/auth_pb';
import { DeviceType } from '../../gen/kantahe/v1/common_pb';
import { fromServer, problem, safeReturnUrl, webDeviceName } from '../auth/form';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { ENVIRONMENT } from '../core/environment';
import { ServerUrl } from '../core/server-url';
import { qrMatrix, qrPath } from './qr';

type Phase = 'starting' | 'waiting' | 'expired' | 'failed';

const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 10_000;
const QUIET_ZONE = 2;

/** The name this TV has in the user's device list. */
export function tvDeviceName(type: DeviceType): string {
  return type === DeviceType.TIZEN ? 'Samsung TV' : type === DeviceType.WEBOS ? 'LG TV' : webDeviceName();
}

/**
 * Signs a TV in without typing a password: it shows a code and the QR of the approval address, and keeps
 * WaitCodeLogin open until someone approves the code on a phone or in a browser.
 */
@Component({
  selector: 'app-code-sign-in-page',
  template: `
    <main class="card tv-card">
      <h1>Sign in to Kantahe</h1>
      @switch (phase()) {
        @case ('starting') {
          <p role="status">Getting a code…</p>
        }
        @case ('waiting') {
          <p>On your phone or computer, sign in to Kantahe and approve this code under "Approve a TV".</p>
          <div class="code-row">
            <p id="login-code" class="code">{{ login()?.code }}</p>
            @if (qr(); as q) {
              <figure>
                <svg role="img" aria-label="QR code of the approval address" [attr.viewBox]="q.view" shape-rendering="crispEdges">
                  <rect [attr.x]="-quiet" [attr.y]="-quiet" [attr.width]="q.size + 2 * quiet" [attr.height]="q.size + 2 * quiet" fill="#fff" />
                  <path [attr.d]="q.path" fill="#000" />
                </svg>
                <figcaption>{{ login()?.approveUrl }}</figcaption>
              </figure>
            }
          </div>
        }
        @case ('expired') {
          <p class="expired">Code expired</p>
          <button #primary type="button" (click)="start()">New code</button>
        }
        @case ('failed') {
          <p class="error" role="alert">{{ failure() }}</p>
          <button #primary type="button" (click)="start()">Try again</button>
        }
      }
      <p><button type="button" class="link" (click)="otherServer()">Use another server</button></p>
    </main>
  `,
  styles: `
    .tv-card {
      max-width: 52rem;
      text-align: center;
    }
    .code-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3rem;
      flex-wrap: wrap;
    }
    .code {
      margin: 0;
      font-size: 4.5rem;
      font-weight: 800;
      letter-spacing: 0.4rem;
      font-variant-numeric: tabular-nums;
    }
    figure {
      margin: 0;
    }
    svg {
      width: 11rem;
      height: 11rem;
      display: block;
      margin: 0 auto 0.25rem;
    }
    figcaption {
      font-size: 0.8rem;
      overflow-wrap: anywhere;
    }
    .expired {
      font-size: 1.75rem;
    }
  `,
})
export class CodeSignInPage {
  private readonly client = injectClient(AuthService);
  private readonly auth = inject(AuthStore);
  private readonly server = inject(ServerUrl);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly env = inject(ENVIRONMENT);
  private readonly injector = inject(Injector);
  private readonly primary = viewChild<ElementRef<HTMLButtonElement>>('primary');

  protected readonly quiet = QUIET_ZONE;
  protected readonly phase = signal<Phase>('starting');
  protected readonly failure = signal('');
  protected readonly login = signal<StartCodeLoginResponse | undefined>(undefined);
  /** The QR of the approval address, when the server has one to give. */
  protected readonly qr = computed(() => {
    const url = this.login()?.approveUrl;
    if (!url) return undefined;
    const matrix = qrMatrix(url);
    return { path: qrPath(matrix), size: matrix.length, view: `${-QUIET_ZONE} ${-QUIET_ZONE} ${matrix.length + 2 * QUIET_ZONE} ${matrix.length + 2 * QUIET_ZONE}` };
  });

  private round = 0; // a new code ends the wait of the old one
  private destroyed = false;
  private readonly stops = new Set<() => void>();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.stopAll();
    });
    void this.start();
  }

  private stopAll(): void {
    for (const stop of [...this.stops]) stop();
  }

  private show(phase: Phase): void {
    this.phase.set(phase);
    // the remote presses what has the focus: after the code ran out or could not be had, that is the button to try again
    if (phase === 'expired' || phase === 'failed') afterNextRender(() => this.primary()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async start(): Promise<void> {
    const round = ++this.round;
    this.stopAll();
    this.failure.set('');
    this.login.set(undefined);
    this.phase.set('starting');
    try {
      const res = await this.client.startCodeLogin({ deviceName: tvDeviceName(this.env.tvDeviceType), deviceType: this.env.tvDeviceType });
      if (this.destroyed || round !== this.round) return;
      this.login.set(res);
      this.phase.set('waiting');
      void this.wait(res.loginId, round);
    } catch (e) {
      if (this.destroyed || round !== this.round) return;
      this.failure.set(problem(e, {}));
      this.show('failed');
    }
  }

  /**
   * Keeps one wait open; when it drops while the code may still be valid it is opened again with the same secret,
   * until the server answers approved or expired.
   */
  private async wait(loginId: string, round: number): Promise<void> {
    let delay = FIRST_RETRY_MS;
    while (!this.destroyed && round === this.round) {
      const attempt = new AbortController();
      const stop = () => attempt.abort();
      this.stops.add(stop);
      let failure: unknown;
      try {
        for await (const msg of this.client.waitCodeLogin({ loginId }, { signal: attempt.signal })) {
          // leaving the page or asking for a new code aborts the call, so no answer of an old one arrives here
          if (msg.result.case === 'approved') {
            const auth = msg.result.value;
            this.auth.signIn(auth);
            // replaceUrl: Back from the library must not land on a code screen of a TV that is already signed in
            await this.router.navigateByUrl(auth.user?.mustChangePassword ? '/me/password' : safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')), { replaceUrl: true });
            return;
          }
          if (msg.result.case === 'expired' && msg.result.value) {
            this.show('expired');
            return;
          }
        }
      } catch (e) {
        failure = e;
      } finally {
        this.stops.delete(stop);
        attempt.abort();
      }
      if (this.destroyed || round !== this.round) return;
      const err = failure === undefined ? undefined : ConnectError.from(failure);
      if (err?.code === Code.NotFound) {
        // the server no longer knows this login (it restarted, or purged it after it expired): it is an expired code
        this.show('expired');
        return;
      }
      if (err?.code === Code.PermissionDenied) {
        // for instance a disabled account: waiting longer cannot help
        this.failure.set(problem(err, { [Code.PermissionDenied]: fromServer }));
        this.show('failed');
        return;
      }
      await this.sleep(delay);
      delay = Math.min(delay * 2, MAX_RETRY_MS);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const stop = () => {
        clearTimeout(timer);
        this.stops.delete(stop);
        resolve();
      };
      const timer = setTimeout(stop, ms);
      this.stops.add(stop);
    });
  }

  protected otherServer(): void {
    this.server.clear();
    this.auth.signOut();
    void this.router.navigateByUrl('/server');
  }
}
