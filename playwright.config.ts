import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: { baseURL: 'http://127.0.0.1:5192', trace: 'on-first-retry' },
  webServer: [
    { command: 'npm run server', env: { PORT: '2568', DATA_DIR: '.data/e2e-rooms' }, url: 'http://127.0.0.1:2568/health', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5192', env: { CROWN_SERVER_URL: 'ws://127.0.0.1:2568' }, url: 'http://127.0.0.1:5192', reuseExistingServer: true, timeout: 120_000 },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
