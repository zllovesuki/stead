import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm --filter @stead/client dev --port 4173",
    url: "http://127.0.0.1:4173/api/session",
    reuseExistingServer: !process.env.CI,
    env: {
      STEAD_TEST_MODE: "1",
      CLOUDFLARE_SEND_METRICS: "false",
      WRANGLER_SEND_METRICS: "false",
    },
    timeout: 60_000,
  },
});
