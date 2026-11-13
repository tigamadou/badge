import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestOrgMember, createTestOrgWithOwner, disconnectDb, getDb } from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { toast } from "../helpers/feedback";

// Page Rôles — /org/[orgId]/roles
// Garde `org.roles.manage` : OWNER. Rôles système communs en lecture, rôles personnalisés de l'organisation.
test.describe("Org — Rôles", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("OWNER voit les rôles système ; un MANAGER est redirigé vers l'organisation", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "orgroles-list" });
    const manager = await createTestOrgMember({ scope: "orgroles-list-mgr", orgId, role: "MANAGER" });
    await loginAs(page, owner);
    await page.goto(`/org/${orgId}/roles`);
    await expect(page.getByRole("heading", { name: /^rôles$/i })).toBeVisible();
    await expect(page.getByText("Gestionnaire")).toBeVisible();

    await page.context().clearCookies();
    await loginAs(page, manager);
    await page.goto(`/org/${orgId}/roles`);
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}$`));
  });

  test("OWNER crée un rôle d'organisation, il apparaît dans le sélecteur d'invitation, puis l'archivage est refusé tant qu'il est attribué", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "orgroles-crud" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/roles/new?scope=ORG`);
    await page.getByLabel("Nom du rôle").fill("Coordination");
    await page.getByLabel(/Accéder à l'organisation/).check();
    await page.getByRole("button", { name: /créer le rôle/i }).click();
    await expect(toast(page, /rôle créé/i)).toBeVisible();
    const role = await getDb().role.findFirstOrThrow({ where: { orgId, name: "Coordination" } });
    expect(role.scope).toBe("ORG");

    await page.goto(`/org/${orgId}/members`);
    await page.getByPlaceholder("Nom complet").fill("Invité Coordination");
    await page.getByPlaceholder("email@exemple.fr").fill(`e2e-coord-${Date.now()}@v2-11-e2e.test`);
    await page.locator("form").getByLabel("Rôle").selectOption({ label: "Coordination" });
    await page.getByRole("button", { name: /^inviter$/i }).click();
    await expect(toast(page, /invitation envoyée/i)).toBeVisible();
    expect(await getDb().orgMembership.count({ where: { orgId, roleId: role.id } })).toBe(1);

    await page.goto(`/org/${orgId}/roles`);
    await page.locator("li", { hasText: "Coordination" }).getByRole("button", { name: /^archiver$/i }).click();
    await expect(toast(page, /attribué/i)).toBeVisible();
    expect((await getDb().role.findUniqueOrThrow({ where: { id: role.id } })).archived).toBe(false);
  });

  test("Un rôle d'une autre organisation répond 404 (page et API)", async ({ page }) => {
    const a = await createTestOrgWithOwner({ scope: "orgroles-idor-a" });
    const b = await createTestOrgWithOwner({ scope: "orgroles-idor-b" });
    const foreign = await getDb().role.create({ data: { scope: "ORG", orgId: b.orgId, name: "Rôle de B" } });
    await loginAs(page, a.owner);

    const res = await page.goto(`/org/${a.orgId}/roles/${foreign.id}`);
    expect(res?.status()).toBe(404);
    const api = await page.request.get(`/api/org/${a.orgId}/roles/${foreign.id}`);
    expect(api.status()).toBe(404);
    const patch = await page.request.patch(`/api/org/${a.orgId}/roles/${foreign.id}`, { data: { name: "Piraté" } });
    expect(patch.status()).toBe(404);
  });
});
