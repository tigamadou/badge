import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestStaff, createTestUser, disconnectDb, getDb } from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";

// Page Fiche utilisateur — /platform/users/[userId]
// Actions : renvoyer un lien de mot de passe (STAFF_SUPPORT+), changer le role
// (STAFF_ADMIN ; top roles reserves au SUPER_ADMIN), archiver (STAFF_ADMIN).
// Garde-fous : on ne peut ni archiver ni retrograder le dernier SUPER_ADMIN,
// ni modifier son propre role. Les actions sont masquees sur sa propre fiche.
test.describe("Platform — Fiche utilisateur", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("STAFF_ADMIN voit la fiche et ses actions", async ({ page }) => {
    const cible = await createTestUser({ scope: "udet-render", verified: true });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "udet-render-staff" });

    await page.goto(`/platform/users/${cible.id}`);
    await expect(page.getByText(cible.email).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /renvoyer un lien de configuration/i }),
    ).toBeVisible();
  });

  test("Utilisateur introuvable -> 404", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "udet-404" });

    const res = await page.goto("/platform/users/user-inexistant-e2e");
    expect(res?.status()).toBe(404);
  });

  test("Sur sa propre fiche, les actions de role et d'archivage sont masquees", async ({ page }) => {
    const staff = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "udet-self" });

    await page.goto(`/platform/users/${staff.id}`);
    await expect(page.getByRole("button", { name: /changer le rôle/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /archiver l'utilisateur/i })).toHaveCount(0);
  });

  // --- Actions UI ---------------------------------------------------------

  test("STAFF_SUPPORT renvoie un lien de mot de passe", async ({ page }) => {
    const cible = await createTestUser({ scope: "udet-reset", verified: true });
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "udet-reset-staff" });
    await mailpit.clear();

    await page.goto(`/platform/users/${cible.id}`);
    await page.getByRole("button", { name: /renvoyer un lien de configuration/i }).click();

    await mailpit.expectMail({ to: cible.email });
    const after = await getDb().user.findUnique({
      where: { id: cible.id },
      select: { inviteToken: true },
    });
    expect(after?.inviteToken).not.toBeNull();
  });

  test("SUPER_ADMIN change le role via le select puis le bouton", async ({ page }) => {
    const cible = await createTestStaff({ scope: "udet-role", role: "STAFF_SUPPORT" });
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "udet-role-staff" });

    await page.goto(`/platform/users/${cible.id}`);
    await page.locator("select").selectOption({ label: "Administrateur" });
    await page.getByRole("button", { name: /changer le rôle/i }).click();

    await expect(async () => {
      const after = await getDb().user.findUnique({
        where: { id: cible.id },
        select: { staffRole: true },
      });
      expect(after?.staffRole).toBe("STAFF_ADMIN");
    }).toPass();
  });

  test("STAFF_ADMIN archive un utilisateur via le bouton", async ({ page }) => {
    const cible = await createTestUser({ scope: "udet-archive", verified: true });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "udet-archive-staff" });
    page.on("dialog", (d) => d.accept());

    await page.goto(`/platform/users/${cible.id}`);
    await page.getByRole("button", { name: /archiver l'utilisateur/i }).click();

    await expect(async () => {
      const after = await getDb().user.findUnique({
        where: { id: cible.id },
        select: { archived: true },
      });
      expect(after?.archived).toBe(true);
    }).toPass();
  });

  // --- Gardes & API -------------------------------------------------------

});
