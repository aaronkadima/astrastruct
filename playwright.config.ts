import { defineConfig, devices } from '@playwright/test';

const basePath = process.env.ASTRA_BASE_PATH || '/astrastruct/';
const baseURL = `http://127.0.0.1:4173${basePath}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    browserName: 'chromium'
  },
  webServer: {
    command: 'npm run preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } },
    { name: 'android-chrome', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'tablet-chromium', use: { ...devices['iPad Pro 11'], browserName: 'chromium' } }
  ]
});
