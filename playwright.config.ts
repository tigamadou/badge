import { defineConfig, devices } from "@playwright/test";

// Config minimale v2-11 : tests E2E sur l'app dev (http://localhost:3000).
// L'app doit etre demarree avant (make dev). On ne lance pas de webServer ici
// car le projet tourne dans Docker -- l'utilisateur est responsable de l'avoir
// up. Chromium uniquement pour reduire le poids des browsers installes.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

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
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
