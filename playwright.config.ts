import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:4000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 1,
  reporter: "list",
  use: { baseURL, ...devices["Desktop Chrome"], trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run preview", url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
