import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 240000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  reporter: [["html", { outputFolder: "artifacts/playwright" }]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
             { name: "mobile", use: { ...devices["Pixel 7"] } }],
});
