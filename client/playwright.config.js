import { defineConfig } from "@playwright/test";

// This suite is written and version-controlled here, but cannot be executed
// inside the sandbox this project was built in — see server/README and
// Appendix L/Runbook: browser-binary downloads (`npx playwright install`)
// are blocked by that sandbox's network allowlist, the same class of issue
// that blocked Prisma. It runs for real in CI (.github/workflows/ci.yml),
// which has normal internet access, and locally with:
//   npx playwright install --with-deps chromium
//   npx playwright test
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --port 5173",
        url: "http://localhost:5173",
        reuseExistingServer: true,
      },
});
