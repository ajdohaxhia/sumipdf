import { defineConfig, devices } from '@playwright/test';

const playwrightPort = process.env.PLAYWRIGHT_PORT || '4173';
const localBaseUrl = `http://127.0.0.1:${playwrightPort}`;

/**
 * Sumi PDF E2E — MPA against Vite preview. No SPA catch-all rewrite.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || localBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: process.env.PLAYWRIGHT_USE_DIST
          ? `npm run preview -- --host 127.0.0.1 --port ${playwrightPort}`
          : `npm run build && npm run preview -- --host 127.0.0.1 --port ${playwrightPort}`,
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 600_000,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
