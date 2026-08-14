import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";

// Page Organisations (liste) — /platform/organizations
// Rôle mini : STAFF_OBSERVER. Filtres en GET (form) : recherche `q` et case
// « Afficher les archivées ». La table ne porte aucune mutation (liens seulement).
test.describe("Platform — Organisations (liste)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("STAFF_OBSERVER voit la liste et le lien de creation", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "porg-render" });
    const org = await getDb().organization.findUnique({ where: { id: orgId } });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "porg-render-staff" });

    await page.goto("/platform/organizations");
    await expect(page.getByRole("heading", { name: /organisations/i }).first()).toBeVisible();
    await expect(page.getByText(org!.name)).toBeVisible();
    await expect(page.getByRole("link", { name: /créer une organisation/i })).toBeVisible();
  });

  // --- Filtres ------------------------------------------------------------

  test("Recherche par nom : filtre la table", async ({ page }) => {
    const { orgId: cibleId } = await createTestOrgWithOwner({ scope: "porg-search-hit" });
    const { orgId: autreId } = await createTestOrgWithOwner({ scope: "porg-search-miss" });
    const cible = await getDb().organization.findUnique({ where: { id: cibleId } });
    const autre = await getDb().organization.findUnique({ where: { id: autreId } });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "porg-search-staff" });

    await page.goto("/platform/organizations");
    await expect(page.getByText(autre!.name)).toBeVisible();

    await page.getByPlaceholder(/rechercher une organisation/i).fill(cible!.name);
    await page.getByRole("button", { name: /^filtrer$/i }).click();

    await expect(page.getByText(cible!.name)).toBeVisible();
    await expect(page.getByText(autre!.name)).toHaveCount(0);
  });

  test("Case 'Afficher les archivées' : bascule entre actives et archivees", async ({ page }) => {
    const { orgId: activeId } = await createTestOrgWithOwner({ scope: "porg-active" });
    const { orgId: archivedId } = await createTestOrgWithOwner({ scope: "porg-archived" });
    await getDb().organization.update({
      where: { id: archivedId },
      data: { archived: true, archivedAt: new Date() },
    });
    const active = await getDb().organization.findUnique({ where: { id: activeId } });
    const archived = await getDb().organization.findUnique({ where: { id: archivedId } });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "porg-archived-staff" });

    // Par defaut : seules les actives.
    await page.goto("/platform/organizations");
    await expect(page.getByText(active!.name)).toBeVisible();
    await expect(page.getByText(archived!.name)).toHaveCount(0);

    // Avec la case cochee : seules les archivees.
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /^filtrer$/i }).click();
    await expect(page.getByText(archived!.name)).toBeVisible();
  });

  test("Recherche sans resultat : table vide", async ({ page }) => {
    await createTestOrgWithOwner({ scope: "porg-noresult" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "porg-noresult-staff" });

    await page.goto("/platform/organizations");
    await page.getByPlaceholder(/rechercher une organisation/i).fill("zzz-inexistant-e2e");
    await page.getByRole("button", { name: /^filtrer$/i }).click();

    await expect(page.getByText(/aucune organisation/i)).toBeVisible();
  });

  // --- Navigation ---------------------------------------------------------

  test("Le lien de creation mene au formulaire", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "porg-nav-new" });

    await page.goto("/platform/organizations");
    await page.getByRole("link", { name: /créer une organisation/i }).click();
    await page.waitForURL("**/platform/organizations/new");
  });

  test("Le clic sur une organisation ouvre sa fiche", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "porg-nav-detail" });
    const org = await getDb().organization.findUnique({ where: { id: orgId } });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "porg-nav-detail-staff" });

    await page.goto("/platform/organizations");
    await page.getByRole("link", { name: org!.name }).first().click();
    await page.waitForURL(`**/platform/organizations/${orgId}`);
  });
});
