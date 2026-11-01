import { defineConfig } from '@playwright/test';

// The tests of the audit's own checks (checks.spec.ts): small pages in a real browser, no server.
export default defineConfig({
  testDir: '.',
  testMatch: 'checks.spec.ts',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { browserName: 'chromium' },
});
