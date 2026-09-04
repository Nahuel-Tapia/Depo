const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  forbidOnly: false,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:4000',
    actionTimeout: 15000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'api-smoke',
      testDir: './tests/nivel-1-smoke',
    },
    {
      name: 'api-integration',
      testDir: './tests/nivel-2-api',
      dependencies: ['api-smoke'],
    },
    {
      name: 'security',
      testDir: './tests/nivel-3-seguridad',
      dependencies: ['api-smoke'],
    },
    {
      name: 'global-test',
      testDir: './tests/global',
    },
    {
      name: 'e2e',
      testDir: './tests/nivel-4-e2e',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:4000/api/health',
    reuseExistingServer: true,
    timeout: 30000,
    env: {
      NODE_ENV: 'test'
    }
  }
});
