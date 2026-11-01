import { BrowserContextOptions, BrowserContext, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { optionsFor, pageChecks, Raw, watch, Watch } from './checks';
import { DEVICE_SCALE_FACTOR, isTouch, Theme, Viewport } from './matrix';
import { Ctx, resetScratch, Role, RouteState } from './routes';
import { Account, Seed } from './seed';

// How a route state is opened: the audit and the layout tests (layout.spec.ts) both go through here, so that a test sees the page the way the
// audit does.

let seed: Seed | undefined;
/** The data of the scratch server (global-setup.ts writes it and tells where). */
export const loadSeed = (): Seed => (seed ??= JSON.parse(readFileSync(process.env['KANTAHE_AUDIT_SEED'] as string, 'utf8')) as Seed);

export function accountFor(role: Role, s: Seed, worker: number): Account | undefined {
  if (role === 'user') return s.user;
  if (role === 'admin') return s.admin;
  if (role === 'scratch') return s.scratch[worker % s.scratch.length];
  return undefined;
}

/** The browser context of a viewport and a theme: its size and pixel ratio, touch and the mobile flag for phones and tablets. */
export const contextOptions = (viewport: Viewport, theme: Theme): BrowserContextOptions => ({
  viewport: { width: viewport.width, height: viewport.height },
  deviceScaleFactor: DEVICE_SCALE_FACTOR,
  isMobile: isTouch(viewport),
  hasTouch: isTouch(viewport),
  colorScheme: theme,
});

export interface Opened {
  ctx: Ctx;
  account: Account | undefined;
  /** What the browser reported while the state was being reached. */
  seen: Watch;
  /** Set when the state could not be reached: a finding of the audit; a layout test should fail on it. */
  unreachable: Raw[];
}

/**
 * Signs in as the state's role, in the theme and (when the viewport says so) with the text at 200%, and brings the page to the state: the
 * account is put in order, the stubs are set, the page opened, and what the person does is done. The page is left as it is.
 */
export async function openState(page: Page, context: BrowserContext, state: RouteState, viewport: Viewport, theme: Theme, worker: number): Promise<Opened> {
  const all = loadSeed();
  const account = accountFor(state.role, all, worker);
  const ctx: Ctx = { page, seed: all, account };

  await context.addInitScript(
    ({ token, deviceId, theme, zoom }) => {
      try {
        localStorage.setItem('kantahe.theme', theme);
        if (token) {
          localStorage.setItem('kantahe.token', token);
          localStorage.setItem('kantahe.deviceId', deviceId ?? '');
        }
      } catch {
        // a page without storage (about:blank)
      }
      if (zoom) {
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style');
          style.textContent = 'html { font-size: 200% !important; }';
          document.head.appendChild(style);
        });
      }
    },
    { token: account?.token, deviceId: account?.deviceId, theme, zoom: viewport.zoom === true },
  );

  const seen = watch(page, state.ignore);
  const unreachable: Raw[] = [];
  try {
    // a scratch account starts every state the same way: a song loaded, nothing queued
    if (state.role === 'scratch') await resetScratch(account!, all.numbers.longBoth);
    await state.before?.(ctx);
    await page.goto(state.path(all), { waitUntil: 'domcontentloaded' });
    if (!state.bare) {
      await expect(page.locator('#splash')).toHaveCount(0, { timeout: 20_000 });
      await (state.ready ?? (({ page }) => expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 })))(ctx);
    }
    await state.after?.(ctx);
    await page.waitForTimeout(300); // transitions and the toast sliding in have ended
  } catch (e) {
    // eslint-disable-next-line no-control-regex -- the colours Playwright puts in its messages
    const why = String((e as Error).message).replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter((l) => l.trim() !== '');
    unreachable.push({ check: 'unreachable', selector: 'state', text: why.slice(0, 2).join(' ').slice(0, 200) });
  }
  return { ctx, account, seen, unreachable };
}

/** The findings of the checks on the page as it is now. */
export async function rawFindings(page: Page): Promise<Raw[]> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(pageChecks, optionsFor(page));
}
