import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  seedEmailVerifyToken,
  getUserById,
  disconnectDb,
} from "./helpers/db";

test.describe("Account register & verify email", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("register form submits and shows verify email message", async ({ page }) => {
    const email = `e2e-reg-${Date.now()}@v2-11-e2e.test`;
    await page.goto("/register");
    await page.getByLabel("Nom complet").fill("Awa Diallo");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/^Mot de passe \(min/i).fill("Test1234!");
    await page.getByLabel("Confirmer le mot de passe").fill("Test1234!");
    await page.getByRole("button", { name: /créer mon compte/i }).click();

    await expect(page.getByText(/compte créé/i)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test("login is refused when email is not verified", async ({ page }) => {
    const user = await createTestUser({ scope: "login-unverified", verified: false });

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Mot de passe").fill(user.password);
    await page.getByRole("button", { name: /se connecter/i }).click();

    // NextAuth callbackUrl renvoie sur /login avec error param ; on reste sur /login.
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.getByText(/email ou mot de passe incorrect/i)).toBeVisible();
  });

  test("verify-email page activates the account and allows login", async ({ page }) => {
    const user = await createTestUser({ scope: "verify-flow", verified: false });
    const plainToken = await seedEmailVerifyToken(user.id);

    await page.goto(`/verify-email/${plainToken}`);
    await expect(page.getByText(/email confirmé/i)).toBeVisible();

    // Verifie la persistance en BDD
    const updated = await getUserById(user.id);
    expect(updated?.emailVerifiedAt).not.toBeNull();

    // Login OK maintenant
    await page.getByRole("link", { name: /se connecter/i }).click();
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Mot de passe").fill(user.password);
    await page.getByRole("button", { name: /se connecter/i }).click();

    // Apres login, NextAuth redirige vers /admin par defaut (cf src/app/login/page.tsx).
    // Pour un compte participant simple, /admin renvoie en 403 ou redirection — on
    // accepte n'importe quelle URL hors /login.
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8000 });
  });
});
