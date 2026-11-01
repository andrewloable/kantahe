import { defineConfig } from '@playwright/test';
import { APP_URL } from './e2e/ports';

// One run of the whole product: the real server with a synthetic library behind the Angular dev
// server, and a real browser (see e2e/global-setup.ts for what is started).
export default defineConfig({
  testDir: 'e2e',
  testIgnore: 'responsive/**', // the responsive audit has configs of its own (npm run e2e:responsive)
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    launchOptions: {
      // songs start without a tap, as on a TV that is dedicated to singing
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
