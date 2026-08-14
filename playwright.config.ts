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
  // Suite complete sequentielle : login NextAuth + /select peuvent depasser 20 s
  // sous charge. 60 s evite les faux timeouts (Chargement… / reste sur /login).
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // 1 retry meme en local : absorbe les flakes residuels de timing (login lent
  // sous charge du run complet sequentiel). Un test qui passe au retry n'est pas
  // une regression.
  retries: 1,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure", 
    screenshot: "only-on-failure",
    // Une video .webm par test, uniquement en mode UI hote (PLAYWRIGHT_VIDEO=on,
    // pose par `make test-e2e-ui`). Off en mode conteneur pour ne pas generer
    video: process.env.PLAYWRIGHT_VIDEO === "on" ? "on" : "off",
    // Tolere le certificat de la CA interne de Caddy quand on teste via
    // https://badge.local (mode UI hote). Sans effet en http (mode conteneur).
    ignoreHTTPSErrors: true,
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
