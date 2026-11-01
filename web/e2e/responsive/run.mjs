// npm run e2e:responsive -- [flags]: the responsive audit (see README.md). The flags are turned into the settings the audit reads, so that
// they can be written the way a person expects; anything else goes on to Playwright.
//   --allow-findings        do not fail on blockers (records a baseline)
//   --baseline=FILE         a report.json of an earlier run: findings it does not have are marked new
//   --viewports=a,b         only these viewports (names or parts of names, e.g. 390x844)
//   --themes=light          only this theme
//   --routes=/library,/me   only the route states whose "route:state" contains one of these words
//   --workers=N             browsers at a time (1 to 8, default 4)
//   --out=DIR               where the report and screenshots go (default: kantahe-responsive in the temp folder)
//   --selftest              add the page with a wide table, to see that the audit fails
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };
const rest = [];
const settings = {
  baseline: 'KANTAHE_AUDIT_BASELINE',
  viewports: 'KANTAHE_AUDIT_VIEWPORTS',
  themes: 'KANTAHE_AUDIT_THEMES',
  routes: 'KANTAHE_AUDIT_ROUTES',
  workers: 'KANTAHE_AUDIT_WORKERS',
  out: 'KANTAHE_AUDIT_OUT',
};
for (const arg of process.argv.slice(2)) {
  const [flag, ...value] = arg.split('=');
  if (flag === '--allow-findings') env.KANTAHE_AUDIT_ALLOW_FINDINGS = '1';
  else if (flag === '--selftest') env.KANTAHE_AUDIT_SELFTEST = '1';
  else if (flag.startsWith('--') && settings[flag.slice(2)] && value.length > 0) {
    const text = value.join('=');
    env[settings[flag.slice(2)]] = flag === '--baseline' || flag === '--out' ? resolve(text) : text; // relative to where the person is, not to web/
  }
  else rest.push(arg);
}

const run = spawnSync('npx', ['playwright', 'test', '-c', join(here, 'audit.config.ts'), ...rest], { stdio: 'inherit', env, cwd: join(here, '..', '..') });
process.exit(run.status ?? 1);
