import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { APP_URL } from '../ports';
import { auditOutDir } from './out';
import { loadBaseline } from './report';
import { workerCount } from './seed';

// Settings that cannot work are refused here, before anything is built, not after a run of minutes.
auditOutDir();
if (process.env['KANTAHE_AUDIT_BASELINE']) loadBaseline(resolve(process.env['KANTAHE_AUDIT_BASELINE']));

// The responsive audit: the real server with the audit's data, the dev server, and every route state at every viewport (see README.md).
export default defineConfig({
  testDir: '.',
  testMatch: 'audit.spec.ts',
  outputDir: join(tmpdir(), 'kantahe-responsive-results'),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: workerCount(),
  retries: 0,
  reporter: [['line'], ['./reporter.ts']],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: APP_URL,
    browserName: 'chromium',
    actionTimeout: 10_000, // a click that cannot be done is a state that cannot be reached, not a run that hangs
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
});
