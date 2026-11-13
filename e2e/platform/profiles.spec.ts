import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  disconnectDb,
  createTestUser,
  createTestProfileSubmission,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";

// Page File d'attente des profils — /platform/profiles
// Role : tout le staff (lecture). Actions : filtre par statut, recherche, lien detail.
test.describe("Platform — Profils (file d'attente)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("le staff voit un profil PENDING dans la file", async ({ page }) => {
    const participant = await createTestUser({ scope: "prof-queue", verified: true, profile: true, profileStatus: "PENDING" });
    await createTestProfileSubmission({ userId: participant.id, status: "PENDING" });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "prof-queue" });

    await page.goto("/platform/profiles");
    await expect(page).toHaveURL(/\/platform\/profiles$/);
    // La ligne affiche l'e-mail du participant dans une cellule.
    await expect(page.getByText(participant.email)).toBeVisible();
  });

  test("le filtre Rejetés masque les profils PENDING", async ({ page }) => {
    const pending = await createTestUser({ scope: "prof-filter-p", verified: true, profile: true, profileStatus: "PENDING" });
    await createTestProfileSubmission({ userId: pending.id, status: "PENDING" });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "prof-filter" });

    await page.goto("/platform/profiles?status=REJECTED");
    await expect(page).toHaveURL(/status=REJECTED/);
    await expect(page.getByText(pending.email)).toHaveCount(0);
  });

  test("un Imprimeur en URL directe est renvoye au tableau de bord", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_PRINTER", scope: "prof-printer" });

    await page.goto("/platform/profiles");
    await expect(page).toHaveURL(/\/platform$/);
    await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible();
  });
});
