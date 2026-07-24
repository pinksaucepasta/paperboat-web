import { defineConfig, devices } from "@playwright/test";

const dashboardURL = "http://127.0.0.1:3100";
const controlPlaneURL = "http://127.0.0.1:43001";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: dashboardURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: "node tests/browser/mock-control-plane.mjs",
      url: controlPlaneURL + "/healthz",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        "PAPERBOAT_SERVER_URL=" +
        controlPlaneURL +
        " NEXT_PUBLIC_ENABLE_DEV_LOGIN=true PAPERBOAT_DEV_SESSION_TOKEN=e2e-session PAPERBOAT_DEV_CSRF_TOKEN=e2e-csrf NEXT_PUBLIC_WORKOS_REDIRECT_URI=" +
        dashboardURL +
        "/callback pnpm exec next dev --webpack -p 3100",
      url: dashboardURL + "/login",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
