import { readFileSync } from 'node:fs';
import type { Check, Finding, Severity } from './checks';

// What the audit leaves behind: report.json (everything), report.md (what to read), index.html (the screenshots).

export interface StateResult {
  /** route:state|viewport|theme */
  id: string;
  route: string;
  state: string;
  viewport: string;
  theme: string;
  screenshot: string;
  /** Findings of one check beyond the limit, counted but not listed. */
  omitted: number;
}

export interface Outcome {
  state: StateResult;
  findings: Finding[];
}

export interface Report {
  generated: string;
  durationMs: number;
  states: StateResult[];
  findings: (Finding & { isNew?: boolean })[];
  counts: Record<Severity, number>;
  /** Present when a baseline was given: the findings whose id it does not have. */
  newCounts?: Record<Severity, number>;
  omitted: number;
}

export const SEVERITIES: Severity[] = ['blocker', 'major', 'minor'];

const MEANING: Record<Check, string> = {
  horizontalOverflow: 'the page scrolls sideways',
  outsideViewport: 'an element sticks out of the window',
  smallTargets: 'a tap target is under 44 px',
  tightTargets: 'two tap targets are less than 8 px apart',
  clippedText: 'text is cut off',
  overlap: 'a fixed or sticky element covers a tap target',
  consoleErrors: 'errors in the console',
  failedRequests: 'requests that failed',
  brokenImages: 'an image did not load',
  unreachable: 'the state could not be reached, so it was not checked',
};
const CHECKS = Object.keys(MEANING) as Check[];

const zero = (): Record<Severity, number> => ({ blocker: 0, major: 0, minor: 0 });

/** The ids of a baseline: a report.json of an earlier run. */
export function loadBaseline(path: string): Set<string> {
  let data: { findings?: { id: string }[] };
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`The baseline ${path} cannot be read: ${(e as Error).message}`, { cause: e });
  }
  if (!Array.isArray(data.findings)) throw new Error(`The baseline ${path} is not a report.json: it has no "findings" list`);
  return new Set(data.findings.map((f) => f.id));
}

/** Puts the outcomes of all states together in a fixed order, so that two runs of one build give the same report. */
export function buildReport(outcomes: Outcome[], durationMs: number, baseline?: Set<string>, generated = new Date().toISOString()): Report {
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const states = outcomes.map((o) => o.state).sort(byId);
  const findings: Report['findings'] = outcomes.flatMap((o) => o.findings).sort(byId);
  const counts = zero();
  const newCounts = zero();
  for (const f of findings) {
    counts[f.severity]++;
    if (baseline) {
      f.isNew = !baseline.has(f.id);
      if (f.isNew) newCounts[f.severity]++;
    }
  }
  return {
    generated,
    durationMs,
    states,
    findings,
    counts,
    ...(baseline ? { newCounts } : {}),
    omitted: states.reduce((n, s) => n + s.omitted, 0),
  };
}

/** The audit fails when there is a blocker, whether or not it is new. */
export const hasBlocker = (r: Report): boolean => r.counts.blocker > 0;

/**
 * Whether the run passes: not when a test of the audit itself broke (that is the harness, and no flag excuses it), and not when there is
 * a blocker unless `allow` is set (--allow-findings, to record a baseline).
 */
export const verdict = (r: Report, broken: string[], allow: boolean): 'passed' | 'failed' => (broken.length > 0 || (hasBlocker(r) && !allow) ? 'failed' : 'passed');

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const minutes = (ms: number) => (ms >= 60_000 ? `${Math.round(ms / 6000) / 10} min` : `${Math.round(ms / 100) / 10} s`);

function groups(findings: Report['findings']) {
  const map = new Map<string, Report['findings']>();
  for (const f of findings) {
    const key = [f.severity, f.check, f.route, f.state, f.pattern].join('\u0000');
    map.set(key, [...(map.get(key) ?? []), f]);
  }
  return [...map.values()].sort((a, b) => {
    const [x, y] = [a[0], b[0]];
    return (
      SEVERITIES.indexOf(x.severity) - SEVERITIES.indexOf(y.severity) ||
      CHECKS.indexOf(x.check) - CHECKS.indexOf(y.check) ||
      (x.route + x.state < y.route + y.state ? -1 : x.route + x.state > y.route + y.state ? 1 : 0) ||
      b.length - a.length ||
      (x.pattern < y.pattern ? -1 : 1)
    );
  });
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (s: string) => '`' + s.replace(/`/g, "'") + '`';

export function toMarkdown(r: Report): string {
  const lines: string[] = [];
  const shots = new Set(r.states.map((s) => s.viewport));
  const themes = new Set(r.states.map((s) => s.theme));
  lines.push('# Responsive audit', '');
  lines.push(
    '> Chromium emulates the size, the pixel ratio and touch of a device. It is not Safari and not an Android WebView, so this report shows the layout, not the device: ' +
      'the real-device checklist in web/e2e/responsive/README.md still has to be done by a person.',
    '',
  );
  lines.push(`* Run: ${r.generated}, ${r.states.length} screenshots (${plural(shots.size, 'viewport')}, ${plural(themes.size, 'theme')}), took ${minutes(r.durationMs)}`);
  lines.push(`* Findings: ${SEVERITIES.map((s) => `${r.counts[s]} ${s}`).join(', ')}${r.omitted ? ` (and ${r.omitted} more that are counted, not listed)` : ''}`);
  if (r.newCounts) lines.push(`* New since the baseline: ${SEVERITIES.map((s) => `${r.newCounts![s]} ${s}`).join(', ')}`);
  lines.push('');
  if (r.findings.length === 0) lines.push('No findings.', '');
  let current = '';
  for (const g of groups(r.findings)) {
    const f = g[0];
    const head = `${f.severity} / ${f.check}`;
    if (head !== current) {
      current = head;
      const checkTotal = r.findings.filter((x) => x.severity === f.severity && x.check === f.check).length;
      lines.push('', `## ${f.severity}: ${f.check} (${checkTotal}), ${MEANING[f.check]}`, '');
      lines.push(r.newCounts ? '| Route | State | Where | Count | Viewports | New | Example |' : '| Route | State | Where | Count | Viewports | Example |');
      lines.push(r.newCounts ? '|---|---|---|---|---|---|---|' : '|---|---|---|---|---|---|');
    }
    const views = [...new Set(g.map((x) => x.viewport))];
    const shown = views.length > 4 ? `${views.slice(0, 4).join(', ')} and ${views.length - 4} more` : views.join(', ');
    const where = f.check === 'horizontalOverflow' ? cell(f.detail ?? '') : `${code(f.pattern)}${f.text ? ' ' + cell(f.text) : ''}`;
    const row = [cell(f.route), f.state, where, String(g.length), shown];
    if (r.newCounts) row.push(String(g.filter((x) => x.isNew).length));
    row.push(`[${f.viewport} ${f.theme}](${f.screenshot})`);
    lines.push(`| ${row.join(' | ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function toHtml(r: Report): string {
  const worst = (id: string): Severity | undefined => {
    const own = r.findings.filter((f) => `${f.route}:${f.state}|${f.viewport}|${f.theme}` === id);
    return SEVERITIES.find((s) => own.some((f) => f.severity === s));
  };
  const bySituation = new Map<string, StateResult[]>();
  for (const s of r.states) bySituation.set(`${s.route} ${s.state}`, [...(bySituation.get(`${s.route} ${s.state}`) ?? []), s]);
  const sections = [...bySituation.entries()].map(([title, list]) => {
    const figures = list
      .map((s) => {
        const sev = worst(s.id);
        const n = r.findings.filter((f) => f.screenshot === s.screenshot).length;
        return `<a class="${sev ?? 'clean'}" href="${esc(s.screenshot)}"><img loading="lazy" src="${esc(s.screenshot)}" alt=""><span>${esc(s.viewport)} ${esc(s.theme)} (${n})</span></a>`;
      })
      .join('');
    const sevs = list.map((s) => worst(s.id));
    const tag = SEVERITIES.find((s) => sevs.includes(s)) ?? 'clean';
    return `<details${tag === 'blocker' ? ' open' : ''}><summary class="${tag}">${esc(title)} <small>${list.length} screenshots</small></summary><div class="grid">${figures}</div></details>`;
  });
  return `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Responsive audit</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 1rem; background: #fff; color: #111; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .5rem; padding: .5rem 0 1rem; }
  .grid a { display: block; border: 3px solid #cfd4da; border-radius: 4px; color: inherit; text-decoration: none; }
  .grid img { display: block; width: 100%; height: 160px; object-fit: cover; object-position: top; background: #eee; }
  .grid span { display: block; font-size: 11px; padding: 2px 4px; }
  .blocker { border-color: #c0392b !important; } .major { border-color: #e67e22 !important; } .minor { border-color: #d4ac0d !important; }
  summary.blocker { color: #c0392b; } summary.major { color: #b9650d; }
  @media (prefers-color-scheme: dark) { body { background: #14161a; color: #e8e8e8; } .grid a { border-color: #3a3f47; } .grid img { background: #222; } }
</style>
<h1>Responsive audit</h1>
<p>${r.states.length} screenshots, ${esc(SEVERITIES.map((s) => `${r.counts[s]} ${s}`).join(', '))}. Chromium emulation, not Safari or an Android WebView. The border is the worst finding: red blocker, orange major, yellow minor. The details are in report.md.</p>
${sections.join('\n')}
`;
}
