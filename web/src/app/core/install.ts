import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { ENVIRONMENT } from './environment';
import { readStore, writeStore } from './storage';

/** What the browser fires when the page can be installed (Chrome and the browsers that share its engine). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** The browser as the install offer needs to see it, so that a test can fake all of it. */
export interface InstallEnv {
  /** Where beforeinstallprompt and appinstalled arrive: the window. */
  target: EventTarget;
  secure: boolean;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** navigator.standalone: an iPhone says so when the page runs from the home screen. */
  standaloneNav: boolean;
  /** The page runs as an installed app (display-mode: standalone). */
  displayStandalone: () => boolean;
  now: () => number;
}

export const INSTALL_ENV = new InjectionToken<InstallEnv>('kantahe install environment', {
  providedIn: 'root',
  factory: () => ({
    target: window,
    secure: window.isSecureContext,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standaloneNav: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    displayStandalone: () => window.matchMedia?.('(display-mode: standalone)').matches === true, // (a browser without matchMedia is not an installed app)
    now: () => Date.now(),
  }),
});

const DISMISSED_KEY = 'kantahe.install.dismissedAt';
/** After "Not now" the banner stays away this long (the Me menu keeps its entry). */
const QUIET_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The offer to put Kantahe on the home screen. Android and desktop Chrome: the browser's own install event is kept and
 * fired from the Install button. iPhone and iPad: no such event exists, so a short guide says Share, then Add to Home Screen.
 * Nothing on a TV, on a page that is not secure, or where the app already runs installed.
 */
@Injectable({ providedIn: 'root' })
export class InstallPrompt {
  private readonly env = inject(INSTALL_ENV);
  private readonly tv = inject(ENVIRONMENT).isTv;
  private readonly event = signal<BeforeInstallPromptEvent | undefined>(undefined);
  private readonly dismissedAt = signal(Number(readStore(DISMISSED_KEY)) || 0);
  /** The browser said the app was installed. */
  readonly installed = signal(false);
  /** The iPhone guide is open. */
  readonly guideOpen = signal(false);

  private readonly running = this.env.standaloneNav || this.env.displayStandalone();
  private readonly ios = /iPad|iPhone|iPod/.test(this.env.userAgent) || (this.env.platform === 'MacIntel' && this.env.maxTouchPoints > 1);

  /** 'prompt': the browser can install it; 'ios': the guide; 'none'. */
  readonly kind = computed<'prompt' | 'ios' | 'none'>(() => {
    if (this.tv || !this.env.secure || this.running || this.installed()) return 'none';
    if (this.event()) return 'prompt';
    return this.ios ? 'ios' : 'none';
  });
  /** There is something to offer (the Me menu entry). */
  readonly available = computed(() => this.kind() !== 'none');
  /** The banner: available, and not put away with Not now during the last 30 days. */
  readonly showBanner = computed(() => {
    const since = this.env.now() - this.dismissedAt();
    // a dismissal that is not in the past (a wrong clock) does not count: it must not hide the banner for ever
    return this.available() && (since < 0 || since >= QUIET_MS);
  });
  /** What the banner calls this device. */
  readonly device = computed(() => (this.ios || /Android|Mobile/.test(this.env.userAgent) ? 'phone' : 'computer'));

  constructor() {
    this.env.target.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); // the browser's own bar stays away: the button below is the offer
      this.event.set(e as BeforeInstallPromptEvent);
    });
    this.env.target.addEventListener('appinstalled', () => this.installed.set(true));
  }

  /** Install: the browser's own dialog, or the guide on an iPhone. */
  async install(): Promise<void> {
    if (this.kind() === 'ios') {
      this.guideOpen.set(true);
      return;
    }
    const e = this.event();
    if (!e) return;
    this.event.set(undefined); // an offer can be used once
    await e.prompt();
  }

  /** Not now. */
  dismiss(): void {
    const now = this.env.now();
    writeStore(DISMISSED_KEY, String(now));
    this.dismissedAt.set(now);
  }
}
