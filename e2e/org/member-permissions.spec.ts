import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestOrgMember, createTestOrgWithOwner, disconnectDb, getDb } from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { toast } from "../helpers/feedback";

// Page Permissions d'un membre — /org/[orgId]/members/[userId]/permissions
// Garde `org.members.permissions.manage` (OWNER) ; jamais pour soi, ni pour un autre propriétaire.
test.describe("Org — Permissions d'un membre", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("OWNER ajoute une permission à un MANAGER : elle lui ouvre l'invitation de membres", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mperm-grant" });
    const manager = await createTestOrgMember({ scope: "mperm-grant-mgr", orgId, role: "MANAGER" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/members`);
    await page.locator("tr", { hasText: manager.email }).getByRole("link", { name: /^permissions$/i }).click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/members/${manager.id}/permissions`), { timeout: 20000 });

    const select = page.getByLabel("Ajustement : Gérer les membres", { exact: true });
    await expect(select).toHaveValue("inherited");
    await select.selectOption("granted");
    await page.getByRole("button", { name: /^enregistrer$/i }).click();
    await expect(toast(page, /permissions enregistrées/i)).toBeVisible();

    const rows = await getDb().userPermissionOverride.findMany({ where: { userId: manager.id, orgId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ permission: "org.members.manage", effect: "GRANT" });

    await page.context().clearCookies();
    await loginAs(page, manager);
    await page.goto(`/org/${orgId}/members`);
    await expect(page.getByPlaceholder("email@exemple.fr")).toBeVisible();
  });

  test("Pas de lien Permissions pour soi-même ni pour un autre propriétaire ; accès direct redirigé", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mperm-owner" });
    const other = await createTestOrgMember({ scope: "mperm-owner-2", orgId, role: "OWNER" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/members`);
    await expect(page.locator("tr", { hasText: owner.email }).getByRole("link", { name: /^permissions$/i })).toHaveCount(0);
    await expect(page.locator("tr", { hasText: other.email }).getByRole("link", { name: /^permissions$/i })).toHaveCount(0);

    await page.goto(`/org/${orgId}/members/${other.id}/permissions`);
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/members$`));
    await page.goto(`/org/${orgId}/members/${owner.id}/permissions`);
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/members$`));
  });

  test("Un MANAGER est redirigé ; un membre d'une autre organisation répond par une redirection, jamais 200", async ({ page }) => {
    const a = await createTestOrgWithOwner({ scope: "mperm-idor-a" });
    const b = await createTestOrgWithOwner({ scope: "mperm-idor-b" });
    const manager = await createTestOrgMember({ scope: "mperm-idor-mgr", orgId: a.orgId, role: "MANAGER" });
    await loginAs(page, a.owner);

    await page.goto(`/org/${a.orgId}/members/${b.owner.id}/permissions`);
    await expect(page).toHaveURL(new RegExp(`/org/${a.orgId}/members$`));
    const api = await page.request.get(`/api/org/${a.orgId}/members/${b.owner.id}/permissions`);
    expect(api.status()).toBe(404);

    await page.context().clearCookies();
    await loginAs(page, manager);
    await page.goto(`/org/${a.orgId}/members/${a.owner.id}/permissions`);
    await expect(page).toHaveURL(new RegExp(`/org/${a.orgId}/members$`));
  });
});
