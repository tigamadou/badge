import { defineConfig, devices } from "@playwright/test";

// Tests E2E. Deux modes d'execution :
//
// 1) Dans le container (mode standard, headless) :
//      docker compose -f docker-compose.dev.yml exec app yarn playwright test
//    Le container embarque chromium Alpine via apk ; on l'injecte via
//    PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser (defini dans le
//    Dockerfile.dev ou passe explicitement).
//
// 2) Depuis l'hote macOS (mode UI Playwright, debug visuel) :
//      yarn playwright install chromium   # premiere fois
//      yarn playwright test --ui          # ou: make test-e2e-ui
//    Sans PLAYWRIGHT_CHROMIUM_EXECUTABLE, Playwright utilise le chromium
//    qu'il a installe localement. L'app dev doit tourner sur localhost:3785
//    (make dev) ; ce mode passe PLAYWRIGHT_BASE_URL=http://localhost:3785.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const CHROMIUM_EXEC = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

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
          ...(CHROMIUM_EXEC ? { executablePath: CHROMIUM_EXEC } : {}),
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        },
      },
    },
  ],
});
