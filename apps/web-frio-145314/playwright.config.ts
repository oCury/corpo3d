import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: { baseURL: 'http://localhost:3020', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:3020', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'celular', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 640 } } },
  ],
});
