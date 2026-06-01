import { defineConfig, devices } from "@playwright/test";

// Config minimale v2-11 : tests E2E sur l'app dev. L'execution standard est :
//
//   docker compose -f docker-compose.dev.yml exec app yarn playwright test
//
// Le container app embarque chromium Alpine (apk add chromium) puisque les
// binaires Playwright officiels supposent glibc. On reference le chromium
// systeme via `executablePath`. Cote container, l'app est accessible sur
// http://localhost:3000 (Next dev tourne dedans).
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const CHROMIUM_EXEC = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium-browser";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "fr-FR",
    timezoneId: "Africa/Abidjan",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: CHROMIUM_EXEC,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        },
      },
    },
  ],
});
