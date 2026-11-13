import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";

// Page Journal global — /platform/activity et /platform/activity/[logId]
// Rôle mini : STAFF_OBSERVER. Filtres en GET : type, staffActor, from, to,
// orgId, userId. Pagination 50/page. Rendu SSR (le filtrage ne passe pas par
// l'API). Lecture seule.
test.describe("Platform — Journal global", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("STAFF_OBSERVER consulte le journal global", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "activity-observer" });

    await page.goto("/platform/activity");
    await expect(
      page.getByRole("heading", { name: /journal d'activité/i }),
    ).toBeVisible();
    // La page comporte un select "Type" (filtre).
    await expect(page.locator("select[name=type]")).toBeVisible();
  });

  // --- Filtres avances (form SSR) -----------------------------------------

  test("Filtre par orgId : ne montre que les entrees de cette org", async ({ page }) => {
    const { orgId: orgA, owner: ownerA } = await createTestOrgWithOwner({ scope: "pact-org-a" });
    const { orgId: orgB, owner: ownerB } = await createTestOrgWithOwner({ scope: "pact-org-b" });
    await getDb().activityLog.create({ data: { type: "ORG_UPDATED", orgId: orgA, userId: ownerA.id } });
    await getDb().activityLog.create({ data: { type: "ORG_ARCHIVED", orgId: orgB, userId: ownerB.id } });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pact-org-staff" });

    await page.goto(`/platform/activity?orgId=${orgA}`);
    // Scope au tableau : les <option> du filtre portent les memes libelles.
    const table = page.locator("tbody");
    await expect(table.getByText("ORG_UPDATED").first()).toBeVisible();
    await expect(table.getByText("ORG_ARCHIVED")).toHaveCount(0);
  });

  test("Filtre par userId : ne montre que les entrees de cet utilisateur", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pact-user" });
    const autre = await createTestUser({ scope: "pact-user-other", verified: true });
    await getDb().activityLog.create({ data: { type: "ORG_UPDATED", orgId, userId: owner.id } });
    await getDb().activityLog.create({ data: { type: "ORG_ARCHIVED", orgId, userId: autre.id } });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pact-user-staff" });

    await page.goto(`/platform/activity?userId=${owner.id}`);
    const table = page.locator("tbody");
    await expect(table.getByText("ORG_UPDATED").first()).toBeVisible();
    await expect(table.getByText("ORG_ARCHIVED")).toHaveCount(0);
  });

  test("Filtre par plage de dates : une plage passee ne renvoie rien", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pact-dates" });
    await getDb().activityLog.create({ data: { type: "ORG_UPDATED", orgId, userId: owner.id } });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pact-dates-staff" });

    // Fenetre entierement anterieure aux entrees creees a l'instant.
    await page.goto("/platform/activity?from=2020-01-01&to=2020-01-02");
    await expect(page.getByText(/aucune entrée/i)).toBeVisible();
  });

  test("Le formulaire de filtre applique le type choisi", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pact-form" });
    await getDb().activityLog.create({ data: { type: "ORG_UPDATED", orgId, userId: owner.id } });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pact-form-staff" });

    await page.goto("/platform/activity");
    await page.locator('select[name="type"]').selectOption("ORG_UPDATED");
    await page.getByRole("button", { name: /^filtrer$/i }).click();

    await expect(page).toHaveURL(/type=ORG_UPDATED/);
    await expect(page.locator("tbody").getByText("ORG_UPDATED").first()).toBeVisible();
  });

  // --- Detail -------------------------------------------------------------

  test("Le detail d'une entree s'affiche", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pact-detail" });
    const log = await getDb().activityLog.create({
      data: { type: "ORG_UPDATED", orgId, userId: owner.id, details: { changedFields: ["name"] } },
    });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "pact-detail-staff" });

    await page.goto(`/platform/activity/${log.id}`);
    await expect(page.getByText(/ORG_UPDATED|organisation/i).first()).toBeVisible();
  });

  test("Detail introuvable -> 404", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "pact-detail-404" });

    const res = await page.goto("/platform/activity/log-inexistant-e2e");
    expect(res?.status()).toBe(404);
  });

  test("un Imprimeur n'a pas Journal dans le menu et est renvoye en URL directe", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_PRINTER", scope: "activity-printer" });

    await page.goto("/platform");
    await expect(page.locator("#app-shell-nav").getByRole("link", { name: "Journal" })).toHaveCount(0);
    await page.goto("/platform/activity");
    await expect(page).toHaveURL(/\/platform$/);
  });
});
