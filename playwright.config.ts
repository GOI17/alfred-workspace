import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/chat-lab.spec.ts',
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4311',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:4311',
    reuseExistingServer: false,
    env: {
      ORCA_BACKGROUND_LAUNCH: '1',
      ALFRED_PORT: '4311',
      ALFRED_HOST: '127.0.0.1',
      ALFRED_DATA_DIR: '.alfred/e2e',
      ALFRED_ACCESS_TOKEN: 'alfred-e2e-only',
    },
  },
})
