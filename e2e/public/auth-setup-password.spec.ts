import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  getDb,
  disconnectDb,
} from "../helpers/db";

// La route /api/auth/setup-password et /setup-password recherchent l'utilisateur
// via `inviteToken` (comparaison de la valeur en clair, cf
// src/app/api/auth/setup-password/route.ts:32 et src/app/setup-password/page.tsx:34).
// Le helper db.ts:seedInviteToken hashe le token (incoherence avec ce flow) --
// on contourne ici en posant directement le token en clair sur le User.
async function seedPlainInviteToken(
  userId: string,
  opts?: { expiresInHours?: number },
): Promise<string> {
  const plain = `e2e-invite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ttlMs = (opts?.expiresInHours ?? 24) * 3600 * 1000;
  await getDb().user.update({
    where: { id: userId },
    data: {
      inviteToken: plain,
      inviteTokenExpiry: new Date(Date.now() + ttlMs),
    },
  });
  return plain;
}

test.describe("Auth setup-password (invite token)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("golden path : valid token sets password and allows login", async ({ page }) => {
    const user = await createTestUser({ scope: "setup-golden", verified: false });
    const token = await seedPlainInviteToken(user.id);
    const newPassword = "InvitePass1234!";

    await page.goto(`/setup-password?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: /configurer votre mot de passe/i })).toBeVisible();

    await page.getByLabel("Nouveau mot de passe").fill(newPassword);
    await page.getByLabel("Confirmer le mot de passe").fill(newPassword);
    await page.getByRole("button", { name: /activer mon compte/i }).click();

    // Apres succes, le form redirige vers /login?email=...
    await page.waitForURL(/\/login/, { timeout: 8000 });

    // Login OK avec le nouveau mot de passe
    await page.getByLabel(/adresse e-mail/i).fill(user.email);
    await page.getByLabel("Mot de passe").fill(newPassword);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8000 });
  });

  test("invalid token shows expired / invalid view", async ({ page }) => {
    await page.goto(`/setup-password?token=this-token-does-not-exist-${Date.now()}`);
    await expect(
      page.getByRole("heading", { name: /lien expir[ée] ou invalide/i }),
    ).toBeVisible();
  });

  test("expired token shows expired / invalid view", async ({ page }) => {
    const user = await createTestUser({ scope: "setup-expired", verified: false });
    const token = await seedPlainInviteToken(user.id, { expiresInHours: 24 });
    // Force l'expiry a une date passee.
    await getDb().user.update({
      where: { id: user.id },
      data: { inviteTokenExpiry: new Date(Date.now() - 60_000) },
    });

    await page.goto(`/setup-password?token=${encodeURIComponent(token)}`);
    await expect(
      page.getByRole("heading", { name: /lien expir[ée] ou invalide/i }),
    ).toBeVisible();
  });

  test("archived user refuses setup-password", async ({ page }) => {
    const user = await createTestUser({ scope: "setup-archived", verified: false });
    const token = await seedPlainInviteToken(user.id);
    await getDb().user.update({
      where: { id: user.id },
      data: { archived: true, archivedAt: new Date() },
    });

    await page.goto(`/setup-password?token=${encodeURIComponent(token)}`);
    await expect(
      page.getByRole("heading", { name: /lien expir[ée] ou invalide/i }),
    ).toBeVisible();
  });
});
