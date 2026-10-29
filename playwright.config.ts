import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  reporter: [['list'], ['html', { outputFolder: 'artifacts/playwright-report' }]],
  outputDir: 'artifacts/playwright-results/',
  use: {
    baseURL: 'https://revolutionx.com.br',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
