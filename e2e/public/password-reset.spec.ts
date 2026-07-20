import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  seedPasswordResetToken,
  getDb,
  disconnectDb,
} from "../helpers/db";
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity } from "../helpers/audit";

test.describe("Account password reset (forgot + reset)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("golden path : forgot -> mail -> reset -> login", async ({ page }) => {
    const user = await createTestUser({ scope: "reset-golden", verified: true });
    const newPassword = "NewPass1234!";

    await mailpit.clear();

    // 1. Demande de reset
    await page.goto("/forgot-password");
    await page.getByLabel(/adresse e-mail/i).fill(user.email);
    await page.getByRole("button", { name: /envoyer le lien/i }).click();
    await expect(
      page.getByText(/un lien de réinitialisation a été envoyé/i),
    ).toBeVisible();

    // 2. Mail recu
    const msg = await mailpit.expectMail({
      to: user.email,
      subjectPattern: /(réinitialisation|réinitialiser)/i,
      timeoutMs: 8000,
    });
    const body = await mailpit.getBody(msg.ID);
    const match = body.HTML.match(/\/reset-password\/([A-Za-z0-9_-]+)/);
    expect(match).not.toBeNull();
    const token = match![1];

    // 3. Reset via le lien
    await page.goto(`/reset-password/${token}`);
    await page.getByLabel("Nouveau mot de passe").fill(newPassword);
    await page.getByLabel("Confirmer le mot de passe").fill(newPassword);
    await page.getByRole("button", { name: /mettre à jour/i }).click();
    await expect(page.getByText(/mot de passe mis à jour/i)).toBeVisible();

    // 4. Login avec le nouveau mot de passe
    await page.getByRole("link", { name: /se connecter/i }).click();
    await page.getByLabel(/adresse e-mail/i).fill(user.email);
    await page.getByLabel("Mot de passe").fill(newPassword);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8000 });

    // 5. Audit
    await expectLastActivity({
      type: "USER_PASSWORD_RESET_COMPLETED",
      userId: user.id,
    });
  });

  test("anti-enumeration : unknown email returns 200 without sending mail", async ({
    page,
  }) => {
    await mailpit.clear();
    const fakeEmail = `e2e-noenum-${Date.now()}@v2-11-e2e.test`;

    const res = await page.request.post("/api/auth/forgot-password", {
      data: { email: fakeEmail },
    });
    expect(res.status()).toBe(200);

    // Sleep court pour laisser le mail eventuel arriver, puis verifie qu'aucun
    // mail n'est parti pour ce destinataire.
    await page.waitForTimeout(500);
    const messages = await mailpit.search({ to: fakeEmail });
    expect(messages.length).toBe(0);
  });

  test("anti-enumeration : unverified email returns 200 without mail", async ({ page }) => {
    await mailpit.clear();
    const user = await createTestUser({ scope: "reset-unverified", verified: false });

    const res = await page.request.post("/api/auth/forgot-password", {
      data: { email: user.email },
    });
    expect(res.status()).toBe(200);

    await page.waitForTimeout(500);
    const messages = await mailpit.search({ to: user.email });
    expect(messages.length).toBe(0);
  });

  test("reset with expired token returns french error", async ({ page }) => {
    const user = await createTestUser({ scope: "reset-expired", verified: true });
    const plain = await seedPasswordResetToken(user.id);
    // Force l'expiry a une date passee.
    await getDb().user.update({
      where: { id: user.id },
      data: { passwordResetExpiry: new Date(Date.now() - 60_000) },
    });

    await page.goto(`/reset-password/${plain}`);
    await page.getByLabel("Nouveau mot de passe").fill("AnotherPass1234!");
    await page.getByLabel("Confirmer le mot de passe").fill("AnotherPass1234!");
    await page.getByRole("button", { name: /mettre à jour/i }).click();

    await expect(page.getByText(/lien invalide ou expiré/i)).toBeVisible();
  });

  test("rate limit /api/auth/forgot-password triggers 429 after 5 requests", async ({
    page,
  }) => {
    // 5 req/min/IP cf src/app/api/auth/forgot-password/route.ts ligne 26.
    // En dev, on partage l'IP entre tous les appels -- la 6e doit renvoyer 429.
    let triggered429 = false;
    for (let i = 0; i < 8; i++) {
      const res = await page.request.post("/api/auth/forgot-password", {
        data: { email: `e2e-rl-forgot-${i}-${Date.now()}@v2-11-e2e.test` },
      });
      if (res.status() === 429) {
        triggered429 = true;
        expect(res.headers()["retry-after"]).toBeDefined();
        break;
      }
    }
    expect(triggered429).toBe(true);
  });

  test("Token de reinitialisation invalide -> message d'erreur", async ({ page }) => {
    await page.goto("/reset-password/token-invalide-e2e");
    await page.getByLabel("Nouveau mot de passe").fill("NouveauMdp123");
    await page.getByLabel("Confirmer le mot de passe").fill("NouveauMdp123");
    await page.getByRole("button", { name: /mettre à jour/i }).click();

    await expect(page.getByText(/invalide|expir/i).first()).toBeVisible();
  });
});
