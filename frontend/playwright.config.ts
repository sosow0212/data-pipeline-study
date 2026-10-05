import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.DASHBOARD_URL || "http://localhost:13000",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1440, height: 1080 },
    trace: "retain-on-failure",
  },
  reporter: [["list"]],
});
