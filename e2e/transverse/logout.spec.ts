import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, disconnectDb } from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";

// v4 Phase 3 : la deconnexion passe par une modal de confirmation (LogoutButton ->
// Modal "Se deconnecter") puis signOut({ callbackUrl: "/" }) vers l'accueil public.
// Le shell staff/org affiche le bouton declencheur "Deconnexion" (label par defaut),
// la modal ayant un bouton de confirmation "Se deconnecter" + un "Annuler".

test.describe("Deconnexion via modal (transverse)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("Annuler la modal conserve la session", async ({ page }) => {
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "logout-cancel" });
    await page.goto("/platform");

    await page.getByRole("button", { name: /^déconnexion$/i }).click();
    await expect(page.getByRole("button", { name: /^annuler$/i })).toBeVisible();
    await page.getByRole("button", { name: /^annuler$/i }).click();

    // Toujours connecte : /platform reste accessible.
    await expect(page).toHaveURL(/\/platform/);
    await expect(page.getByRole("button", { name: /^déconnexion$/i })).toBeVisible();
  });

  test("Confirmer la modal deconnecte et redirige vers l'accueil", async ({ page }) => {
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "logout-confirm" });
    await page.goto("/platform");

    await page.getByRole("button", { name: /^déconnexion$/i }).click();
    // Confirme : signOut efface la session puis redirige vers callbackUrl "/". En conteneur
    // cette redirection cible NEXTAUTH_URL (https://badge.local, injoignable) -- limite dev-env ;
    // on verifie l'effet fonctionnel : la session est bien effacee.
    await Promise.all([
      page
        .waitForResponse((r) => r.url().includes("/api/auth/signout"), { timeout: 8000 })
        .catch(() => undefined),
      page.getByRole("button", { name: /^se déconnecter$/i }).click(),
    ]);

    // Session effacee : une page authentifiee renvoie desormais vers /login.
    await page.goto("/platform");
    await page.waitForURL(/\/login/, { timeout: 8000 });
  });
});
