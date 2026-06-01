import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  getUserById,
  disconnectDb,
} from "./helpers/db";

test.describe("Account profile edit", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("user can edit profile fields and changes persist", async ({ page }) => {
    const user = await createTestUser({ scope: "profile-edit", verified: true });

    // Login
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Mot de passe").fill(user.password);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8000 });

    await page.goto("/account/profile");
    await expect(page.getByRole("heading", { name: /mon profil/i })).toBeVisible();

    // Edition des champs texte (les uploads photo/doc demandent un fichier reel,
    // on les saute ici et on s'attend a un profil partiellement complet apres
    // submit -- participantProfileCompletedAt reste null).
    await page.getByLabel("Prénom").fill("Awa");
    await page.getByLabel("Nom", { exact: true }).fill("Diallo");
    await page.getByLabel(/structure/i).fill("ENSEA E2E");
    await page.getByLabel(/numéro de pièce/i).fill("CI-E2E-PROFILE");

    await page.getByRole("button", { name: /enregistrer/i }).click();

    // Verification persistence
    await page.waitForTimeout(1000); // attend la fin de l'update + refresh
    const updated = await getUserById(user.id);
    expect(updated?.firstName).toBe("Awa");
    expect(updated?.lastName).toBe("Diallo");
    expect(updated?.structure).toBe("ENSEA E2E");
  });
});
