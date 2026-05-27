const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './scratch',
  timeout: 120000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    actionTimeout: 15000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
