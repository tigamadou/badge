import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";

// Page Connexion — /login
// Publique. `signIn("credentials")` puis redirection vers /select (dispatcher).
// Les comptes non verifies, bloques ou archives sont refuses par `authorize`.
test.describe("Public — Connexion", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("La page affiche le formulaire", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /connexion/i })).toBeVisible();
    await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("Identifiants valides -> redirection vers l'espace", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "login-ok" });

    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(owner.email);
    await page.getByLabel("Mot de passe").fill(owner.password);
    await page.getByRole("button", { name: /se connecter/i }).click();

    // /select redirige vers l'unique espace accessible.
    await page.waitForURL(`**/org/${orgId}`);
  });

  test("Mot de passe incorrect -> message d'erreur", async ({ page }) => {
    const user = await createTestUser({ scope: "login-badpass", verified: true });

    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(user.email);
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
    await page.getByRole("button", { name: /se connecter/i }).click();

    await expect(page.getByText(/email ou mot de passe incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("E-mail inconnu -> message d'erreur", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(`inconnu-${Date.now()}@v2-11-e2e.test`);
    await page.getByLabel("Mot de passe").fill("peu-importe");
    await page.getByRole("button", { name: /se connecter/i }).click();

    await expect(page.getByText(/email ou mot de passe incorrect/i)).toBeVisible();
  });

  test("Compte non verifie -> connexion refusee", async ({ page }) => {
    const user = await createTestUser({ scope: "login-unverified", verified: false });

    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(user.email);
    await page.getByLabel("Mot de passe").fill(user.password);
    await page.getByRole("button", { name: /se connecter/i }).click();

    await expect(page.getByText(/email ou mot de passe incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("Compte bloque -> connexion refusee", async ({ page }) => {
    const user = await createTestUser({ scope: "login-blocked", verified: true });
    await getDb().user.update({ where: { id: user.id }, data: { blocked: true } });

    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(user.email);
    await page.getByLabel("Mot de passe").fill(user.password);
    await page.getByRole("button", { name: /se connecter/i }).click();

    await expect(page.getByText(/email ou mot de passe incorrect/i)).toBeVisible();
  });

  // --- Redirection apres connexion ----------------------------------------

  test("Le callbackUrl ramene a la page demandee", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "login-callback" });

    // Une page protegee redirige vers /login en conservant la cible.
    await page.goto(`/org/${orgId}/members`);
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("callbackUrl");

    await page.getByLabel("Adresse e-mail").fill(owner.email);
    await page.getByLabel("Mot de passe").fill(owner.password);
    await page.getByRole("button", { name: /se connecter/i }).click();

    // Le formulaire pousse vers /select, qui dispatche vers l'unique espace.
    await page.waitForURL(`**/org/${orgId}`);
  });
});
