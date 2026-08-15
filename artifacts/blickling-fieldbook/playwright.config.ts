import { defineConfig, devices } from "@playwright/test";

// Accessibility/E2E checks. Run with the dev stack up (web on :8080 proxying
// the API):  pnpm --filter @workspace/blickling-fieldbook run test:a11y
// Credentials come from A11Y_EMAIL / A11Y_PASSWORD (a dev/test account).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.A11Y_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    // On NixOS the downloaded Playwright chromium lacks system libraries;
    // use the system chromium instead (set A11Y_CHROMIUM or have `chromium` on PATH).
    launchOptions: process.env.A11Y_CHROMIUM ? { executablePath: process.env.A11Y_CHROMIUM } : {},
  },
  // Sign in once via the API and share the session across tests: the login
  // endpoint is rate-limited, so per-test UI logins would trip the limiter.
  globalSetup: "./e2e/global-setup.ts",
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/state.json" } },
    { name: "mobile", use: { ...devices["Pixel 7"], storageState: "e2e/.auth/state.json" } },
  ],
});
