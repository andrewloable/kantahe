import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_URL } from '../ports';
import { workerCount } from './seed';

// The layout tests of single bugs (layout.spec.ts): the same scratch server and data as the audit, but real assertions.
export default defineConfig({
  testDir: '.',
  testMatch: 'layout.spec.ts',
  outputDir: join(tmpdir(), 'kantahe-layout-results'),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: workerCount(),
  retries: 0,
  reporter: [['list']],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: APP_URL,
    browserName: 'chromium',
    actionTimeout: 10_000,
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
});
