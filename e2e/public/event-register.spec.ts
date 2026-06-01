import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  createTestEvent,
  getLatestRegistrationForUser,
  disconnectDb,
} from "./helpers/db";

test.describe("Event registration flow", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("public event page shows login/register CTA when not logged in", async ({ page }) => {
    const { eventSlug } = await createTestEvent({ scope: "public-cta" });

    await page.goto(`/e/${eventSlug}`);
    await expect(page.getByText(/se connecter pour s'inscrire/i)).toBeVisible();
    await expect(page.getByText(/créer un compte/i)).toBeVisible();
  });

  test("logged-in user with complete profile can register to an event", async ({ page }) => {
    const user = await createTestUser({ scope: "evt-flow", verified: true, profile: true });
    const { eventSlug } = await createTestEvent({ scope: "evt-flow" });

    // Login
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Mot de passe").fill(user.password);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8000 });

    // Va sur /e/[slug] et clique sur "S'inscrire"
    await page.goto(`/e/${eventSlug}`);
    await page.getByRole("link", { name: /s'inscrire à cet événement/i }).click();

    // Sur /e/[slug]/register : selectionne la categorie + accepte + soumet
    await expect(page).toHaveURL(new RegExp(`/e/${eventSlug}/register`));
    await page.getByLabel(/visiteur/i).check();
    await page.getByRole("checkbox").last().check();
    await page.getByRole("button", { name: /valider mon inscription/i }).click();

    // Redirection vers success
    await page.waitForURL(new RegExp(`/e/${eventSlug}/success`), { timeout: 8000 });
    await expect(page.getByText(/votre inscription a bien été enregistrée/i)).toBeVisible();

    // Verifie la registration en BDD
    const reg = await getLatestRegistrationForUser(user.id);
    expect(reg).not.toBeNull();
    expect(reg?.status).toBe("PENDING");
    expect(reg?.snapshotFirstName).toBe("Awa");
  });

  test("user with incomplete profile is redirected to /account/profile/complete", async ({ page }) => {
    const user = await createTestUser({ scope: "evt-incomplete", verified: true, profile: false });
    const { eventSlug } = await createTestEvent({ scope: "evt-incomplete" });

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Mot de passe").fill(user.password);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8000 });

    await page.goto(`/e/${eventSlug}/register`);
    await page.waitForURL(/\/account\/profile\/complete/, { timeout: 8000 });
    await expect(page.getByRole("heading", { name: /compléter votre profil/i })).toBeVisible();
  });
});
