import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestStaff, disconnectDb, getDb } from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { toast } from "../helpers/feedback";
import { expectLastActivity } from "../helpers/audit";

// Page Permissions d'un utilisateur — /platform/users/[userId]/permissions
// Garde `users.permissions.manage` (SUPER_ADMIN) ; jamais pour son propre compte. États hérité / ajouté / retiré.
test.describe("Platform — Permissions d'un utilisateur", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("SUPER_ADMIN retire une permission héritée, l'ajustement est enregistré et journalisé", async ({ page }) => {
    const cible = await createTestStaff({ scope: "uperm-revoke", role: "STAFF_SUPPORT" });
    const actor = await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "uperm-revoke-actor" });

    await page.goto(`/platform/users/${cible.id}`);
    await page.getByRole("link", { name: /^permissions$/i }).click();
    await expect(page).toHaveURL(new RegExp(`/platform/users/${cible.id}/permissions`), { timeout: 20000 });
    await expect(page.getByRole("heading", { name: /permissions de/i })).toBeVisible();

    const toggle = page.getByRole("switch", { name: "Consulter les profils", exact: true });
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await page.getByRole("button", { name: /^enregistrer$/i }).first().click();
    await expect(toast(page, /permissions enregistrées/i)).toBeVisible();

    const rows = await getDb().userPermissionOverride.findMany({ where: { userId: cible.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ effect: "REVOKE", orgId: null });
    await expectLastActivity({ type: "USER_PERMISSIONS_CHANGED", targetId: cible.id, userId: actor.id });

    await page.reload();
    await expect(page.getByRole("switch", { name: "Consulter les profils", exact: true })).not.toBeChecked();
  });

  test("Un STAFF_ADMIN est redirigé vers la fiche ; la fiche n'offre pas le lien", async ({ page }) => {
    const cible = await createTestStaff({ scope: "uperm-guard", role: "STAFF_SUPPORT" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "uperm-guard-actor" });

    await page.goto(`/platform/users/${cible.id}`);
    await expect(page.getByRole("link", { name: /^permissions$/i })).toHaveCount(0);
    await page.goto(`/platform/users/${cible.id}/permissions`);
    await expect(page).toHaveURL(new RegExp(`/platform/users/${cible.id}$`));
  });

  test("Sur son propre compte : pas de lien, redirection vers la fiche", async ({ page }) => {
    const me = await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "uperm-self" });
    await page.goto(`/platform/users/${me.id}`);
    await expect(page.getByRole("link", { name: /^permissions$/i })).toHaveCount(0);
    await page.goto(`/platform/users/${me.id}/permissions`);
    await expect(page).toHaveURL(new RegExp(`/platform/users/${me.id}$`));
  });

  test("L'API refuse un ajout d'une permission réservée", async ({ page }) => {
    const cible = await createTestStaff({ scope: "uperm-reserved", role: "STAFF_SUPPORT" });
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "uperm-reserved-actor" });
    const res = await page.request.put(`/api/platform/users/${cible.id}/permissions`, {
      data: { orgId: null, overrides: [{ permission: "platform.roles.manage", effect: "GRANT" }] },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toBe("RESERVED_PERMISSION");
  });
});
