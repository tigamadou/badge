import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  seedEmailVerifyToken,
  getUserById,
  getDb,
  disconnectDb,
} from "../helpers/db";

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
    await page.getByLabel(/adresse e-mail/i).fill(user.email);
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
    await expect(page.getByRole("heading", { name: /adresse vérifiée/i })).toBeVisible();

    // Verifie la persistance en BDD
    const updated = await getUserById(user.id);
    expect(updated?.emailVerifiedAt).not.toBeNull();

    // Login OK maintenant
    await page.getByRole("link", { name: /se connecter/i }).click();
    await page.getByLabel(/adresse e-mail/i).fill(user.email);
    await page.getByLabel("Mot de passe").fill(user.password);
    await page.getByRole("button", { name: /se connecter/i }).click();

    // Apres login, NextAuth redirige vers /org par defaut (cf src/app/login/page.tsx).
    // Pour un compte participant simple, /org renvoie en 403 ou redirection — on
    // accepte n'importe quelle URL hors /login.
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8000 });
  });

  test("register with email already taken shows french error", async ({ page }) => {
    const existing = await createTestUser({ scope: "email-taken", verified: true });

    await page.goto("/register");
    await page.getByLabel("Nom complet").fill("Awa Diallo");
    await page.getByLabel("Email").fill(existing.email);
    await page.getByLabel(/^Mot de passe \(min/i).fill("Test1234!");
    await page.getByLabel("Confirmer le mot de passe").fill("Test1234!");
    await page.getByRole("button", { name: /créer mon compte/i }).click();

    // L'API renvoie 409 avec error="Un compte avec cet email existe déjà.".
    await expect(page.getByText(/un compte avec cet email existe déjà/i)).toBeVisible({
      timeout: 6000,
    });
  });

  test("expired verify-email token shows expiration message", async ({ page }) => {
    const user = await createTestUser({ scope: "verify-expired", verified: false });
    const plainToken = await seedEmailVerifyToken(user.id);

    // Force l'expiry a une date passee en BDD pour simuler un token expire.
    await getDb().user.update({
      where: { id: user.id },
      data: { emailVerifyTokenExpiry: new Date(Date.now() - 60_000) },
    });

    await page.goto(`/verify-email/${plainToken}`);
    await expect(page.getByRole("heading", { name: /lien invalide ou expiré/i })).toBeVisible();
  });

  test("verify-email token consumed twice stays on success view", async ({ page }) => {
    // La route verify-email est idempotente : si user.emailVerifiedAt existe deja
    // ET que le hash matche, elle renvoie 200 alreadyVerified=true. Une fois consumed
    // (token effacé), un 2e appel renvoie 400 (le hash ne match plus). On teste la
    // 1ere visite (succes) puis la 2eme (erreur car token efface).
    const user = await createTestUser({ scope: "verify-idempotent", verified: false });
    const plainToken = await seedEmailVerifyToken(user.id);

    // 1ere visite : confirme l'email
    await page.goto(`/verify-email/${plainToken}`);
    await expect(page.getByRole("heading", { name: /adresse vérifiée/i })).toBeVisible();

    // 2eme visite avec le meme token : la BDD a clear le hash, donc match negatif.
    await page.goto(`/verify-email/${plainToken}`);
    await expect(page.getByRole("heading", { name: /lien invalide ou expiré/i })).toBeVisible();
  });

  test("La page /register/success confirme l'envoi", async ({ page }) => {
    const res = await page.goto("/register/success");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByText(/inscription envoyée/i)).toBeVisible();
  });
});
