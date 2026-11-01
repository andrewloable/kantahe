import { test } from '@playwright/test';
import { auditPage, stateId } from './checks';
import { pick, Theme, THEMES, VIEWPORTS } from './matrix';
import { contextOptions, openState } from './open-state';
import { auditOutDir } from './out';
import { Outcome } from './report';
import { RouteState, states } from './routes';

// One test per route state, viewport and theme. A test never fails because of what it finds: it attaches the findings, and the reporter
// (reporter.ts) puts them together. A test fails only when the harness itself is broken.

const out = auditOutDir();
const selftest = process.env['KANTAHE_AUDIT_SELFTEST'] === '1';
const viewports = pick(VIEWPORTS, process.env['KANTAHE_AUDIT_VIEWPORTS']);
const themes = pick(THEMES.map((name) => ({ name })), process.env['KANTAHE_AUDIT_THEMES']).map((t) => t.name as Theme);

/** The states whose "route:state" contains one of the words of KANTAHE_AUDIT_ROUTES (all when it is empty). */
function chosen(all: RouteState[], list: string | undefined): RouteState[] {
  const words = (list ?? '').split(',').map((w) => w.trim()).filter(Boolean);
  if (words.length === 0) return all;
  const keep = all.filter((s) => words.some((w) => `${s.route}:${s.state}`.includes(w)));
  if (keep.length === 0) throw new Error(`No route state matches "${list}"`);
  return keep;
}
const wanted = chosen(states(selftest), process.env['KANTAHE_AUDIT_ROUTES']);

for (const viewport of viewports) {
  for (const theme of themes) {
    test.describe(`${viewport.name} ${theme}`, () => {
      test.use(contextOptions(viewport, theme));

      for (const state of wanted) {
        test(`${state.route} ${state.state}`, async ({ page, context }, info) => {
          const meta = { route: state.route, state: state.state, viewport: viewport.name, theme, core: state.core };
          // a state that cannot be reached is itself a finding; the page is looked at as it is
          const { seen, unreachable } = await openState(page, context, state, viewport, theme, info.parallelIndex);
          const { findings, omitted, screenshot } = await auditPage(page, meta, out, seen, undefined, unreachable);
          const outcome: Outcome = {
            state: { id: stateId(meta), route: meta.route, state: meta.state, viewport: meta.viewport, theme: meta.theme, screenshot, omitted },
            findings,
          };
          await info.attach('audit', { body: JSON.stringify(outcome), contentType: 'application/json' });
        });
      }
    });
  }
}
