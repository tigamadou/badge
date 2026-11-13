import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestOrgWithOwner, disconnectDb } from "../helpers/db";
import { loginAs, loginAsStaff } from "../helpers/auth";

// Socle rôles/permissions : les rôles système écrits par les helpers (roleId + enum hérité)
// ouvrent bien les espaces attendus. La page d'atterrissage de l'Imprimeur arrive avec le lot 2a.
test.describe("Transverse — Socle rôles et permissions", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("Un STAFF_ADMIN voit /platform", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "socle-admin" });
    await page.goto("/platform");
    await expect(page).toHaveURL(/\/platform/);
    await expect(page.getByRole("button", { name: /^déconnexion$/i })).toBeVisible();
  });

  test("Un STAFF_OBSERVER voit /platform", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "socle-observer" });
    await page.goto("/platform");
    await expect(page).toHaveURL(/\/platform/);
    await expect(page.getByRole("button", { name: /^déconnexion$/i })).toBeVisible();
  });

  test("Un OWNER voit /org/{id} et la Documentation mène à la page d'attente", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "socle-owner" });
    await loginAs(page, owner);
    await page.goto(`/org/${orgId}`);
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}`));
    await page.getByRole("link", { name: /^documentation$/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/docs`));
    await expect(page.getByText("Bientôt disponible")).toBeVisible();
  });

  test("Un compte STAFF_PRINTER se connecte sans erreur serveur", async ({ page }) => {
    const responses: number[] = [];
    page.on("response", (r) => {
      if (r.status() >= 500) responses.push(r.status());
    });
    await loginAsStaff(page, { role: "STAFF_PRINTER", scope: "socle-printer" });
    expect(page.url()).not.toContain("/login");
    expect(responses).toEqual([]);
  });
});
