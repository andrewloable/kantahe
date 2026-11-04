import { TestBed } from '@angular/core/testing';
import { ENVIRONMENT } from './environment';
import { INSTALL_ENV, InstallEnv, InstallPrompt } from './install';

const DAY = 24 * 60 * 60 * 1000;
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

/** The browser, faked: the window's events, the user agent, whether the page is secure and already installed, and the clock. */
function setup(over: Partial<InstallEnv> = {}, tv = false) {
  localStorage.clear();
  const env: InstallEnv = { target: new EventTarget(), secure: true, userAgent: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5, standaloneNav: false, displayStandalone: () => false, now: () => 1_000_000_000_000, ...over };
  TestBed.configureTestingModule({ providers: [{ provide: INSTALL_ENV, useValue: env }, { provide: ENVIRONMENT, useValue: { isTv: tv } }] });
  const install = TestBed.inject(InstallPrompt);
  /** What Chrome fires when the page can be installed. */
  const offer = () => {
    const prompt = vi.fn(() => Promise.resolve());
    const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    env.target.dispatchEvent(e);
    return { e, prompt };
  };
  return { env, install, offer };
}

describe('InstallPrompt', () => {
  afterEach(() => localStorage.clear());

  it('offers nothing until the browser says the page can be installed', () => {
    const { install } = setup();
    expect(install.kind()).toBe('none');
    expect(install.showBanner()).toBe(false);
  });

  it('REGRESSION: keeps the browser\'s install offer (its own mini bar is held back) and shows the Install button', () => {
    const { install, offer } = setup();
    const { e } = offer();
    expect(e.defaultPrevented, 'the event is kept for later, not shown by the browser').toBe(true);
    expect(install.kind()).toBe('prompt');
    expect(install.showBanner()).toBe(true);
    expect(install.device()).toBe('phone');
  });

  it('install() asks the browser once and the offer is spent', async () => {
    const { install, offer } = setup();
    const { prompt } = offer();
    await install.install();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(install.kind()).toBe('none');
    await install.install();
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('appinstalled: installed, nothing offered, no Me entry', () => {
    const { install, offer, env } = setup();
    offer();
    env.target.dispatchEvent(new Event('appinstalled'));
    expect(install.installed()).toBe(true);
    expect(install.kind()).toBe('none');
    expect(install.showBanner()).toBe(false);
    expect(install.available()).toBe(false);
  });

  it('an iPhone gets the guide (there is no install event there), an iPad that says it is a Mac too', () => {
    const phone = setup({ userAgent: IPHONE, platform: 'iPhone' });
    expect(phone.install.kind()).toBe('ios');
    expect(phone.install.device()).toBe('phone');
    expect(phone.install.showBanner()).toBe(true);
    TestBed.resetTestingModule();
    const ipad = setup({ userAgent: DESKTOP, platform: 'MacIntel', maxTouchPoints: 5 });
    expect(ipad.install.kind()).toBe('ios');
    TestBed.resetTestingModule();
    const mac = setup({ userAgent: DESKTOP, platform: 'MacIntel', maxTouchPoints: 0 });
    expect(mac.install.kind()).toBe('none');
  });

  it('nothing where the app already runs installed (display-mode or navigator.standalone)', () => {
    expect(setup({ userAgent: IPHONE, platform: 'iPhone', standaloneNav: true }).install.kind()).toBe('none');
    TestBed.resetTestingModule();
    const a = setup({ displayStandalone: () => true });
    a.offer();
    expect(a.install.kind()).toBe('none');
    expect(a.install.available()).toBe(false);
  });

  it('nothing on a TV build, and nothing on a page that is not secure', () => {
    const tv = setup({}, true);
    tv.offer();
    expect(tv.install.kind()).toBe('none');
    TestBed.resetTestingModule();
    const http = setup({ secure: false });
    http.offer();
    expect(http.install.kind()).toBe('none');
    TestBed.resetTestingModule();
    const http2 = setup({ secure: false, userAgent: IPHONE, platform: 'iPhone' });
    expect(http2.install.kind()).toBe('none');
  });

  it('Not now hides the banner for 30 days but the Me entry stays; after that the banner returns', () => {
    const now = { t: 1_000_000_000_000 };
    const { install, offer, env } = setup({ now: () => now.t });
    offer();
    install.dismiss();
    expect(install.showBanner()).toBe(false);
    expect(install.available()).toBe(true);
    expect(localStorage.getItem('kantahe.install.dismissedAt')).toBe(String(now.t));
    // a new page within 30 days
    TestBed.resetTestingModule();
    now.t += 29 * DAY;
    TestBed.configureTestingModule({ providers: [{ provide: INSTALL_ENV, useValue: env }, { provide: ENVIRONMENT, useValue: { isTv: false } }] });
    const again = TestBed.inject(InstallPrompt);
    env.target.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'dismissed' }) }));
    expect(again.showBanner()).toBe(false);
    expect(again.available()).toBe(true);
    // after 31 days
    TestBed.resetTestingModule();
    now.t += 2 * DAY;
    TestBed.configureTestingModule({ providers: [{ provide: INSTALL_ENV, useValue: env }, { provide: ENVIRONMENT, useValue: { isTv: false } }] });
    const later = TestBed.inject(InstallPrompt);
    env.target.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'dismissed' }) }));
    expect(later.showBanner()).toBe(true);
  });

  it('REGRESSION: a dismissal dated in the future (a wrong clock) does not hide the banner for ever', () => {
    localStorage.clear();
    const env: InstallEnv = { target: new EventTarget(), secure: true, userAgent: ANDROID, platform: 'Linux', maxTouchPoints: 5, standaloneNav: false, displayStandalone: () => false, now: () => 1_000_000_000_000 };
    localStorage.setItem('kantahe.install.dismissedAt', String(env.now() + 10 * DAY));
    TestBed.configureTestingModule({ providers: [{ provide: INSTALL_ENV, useValue: env }, { provide: ENVIRONMENT, useValue: { isTv: false } }] });
    const install = TestBed.inject(InstallPrompt);
    env.target.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'dismissed' }) }));
    expect(install.showBanner()).toBe(true);
    TestBed.resetTestingModule();
    localStorage.setItem('kantahe.install.dismissedAt', String(env.now() - 10 * DAY));
    TestBed.configureTestingModule({ providers: [{ provide: INSTALL_ENV, useValue: env }, { provide: ENVIRONMENT, useValue: { isTv: false } }] });
    const recent = TestBed.inject(InstallPrompt);
    env.target.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'dismissed' }) }));
    expect(recent.showBanner()).toBe(false);
  });

  it('the iPhone guide opens and closes, from the banner or the Me entry', () => {
    const { install } = setup({ userAgent: IPHONE, platform: 'iPhone' });
    expect(install.guideOpen()).toBe(false);
    void install.install(); // on an iPhone "install" opens the guide
    expect(install.guideOpen()).toBe(true);
    install.guideOpen.set(false);
    expect(install.guideOpen()).toBe(false);
  });

  it('a desktop browser is "this computer"', () => {
    const { install, offer } = setup({ userAgent: DESKTOP, platform: 'MacIntel', maxTouchPoints: 0 });
    offer();
    expect(install.device()).toBe('computer');
  });
});
