import { defineConfig, devices } from "@playwright/test";

const PORT = 17001;
const baseURL = `http://localhost:${PORT}`;
/** The RaceGame API for the online tests (17101: dev runs its own on 17100). */
const API_PORT = 17101;
const API_URL = `ws://localhost:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    // Always test the production build. CI builds both in earlier steps, the
    // site with NEXT_PUBLIC_API_URL pointing at this API.
    {
      command: process.env.CI
        ? `npx next start -p ${PORT}`
        : `npm run build && npx next start -p ${PORT}`,
      url: `${baseURL}/en`,
      env: { NEXT_PUBLIC_API_URL: API_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: process.env.CI
        ? "node apps/api/dist/main.js"
        : "npm run build:api && node apps/api/dist/main.js",
      cwd: "../..",
      url: `http://localhost:${API_PORT}/health`,
      env: { PORT: String(API_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
