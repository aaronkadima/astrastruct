import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173/astrastruct/',
    trace: 'retain-on-failure',
    browserName: 'chromium'
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173/astrastruct/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } },
    { name: 'android-chrome', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'tablet-chromium', use: { ...devices['iPad Pro 11'], browserName: 'chromium' } }
  ]
});
