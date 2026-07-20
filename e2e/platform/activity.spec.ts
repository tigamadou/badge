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

  test("Filtre par type=ORG_CREATED retourne uniquement les logs de ce type", async ({
    page,
  }) => {
    const observer = await loginAsStaff(page, {
      role: "STAFF_OBSERVER",
      scope: "activity-filter-type",
    });

    // Seed deux logs ORG_CREATED + un log USER_CREATED pour bruit.
    const { orgId: org1 } = await createTestOrgWithOwner({ scope: "act-type-1" });
    const { orgId: org2 } = await createTestOrgWithOwner({ scope: "act-type-2" });
    await getDb().activityLog.createMany({
      data: [
        { type: "ORG_CREATED", userId: observer.id, orgId: org1 },
        { type: "ORG_CREATED", userId: observer.id, orgId: org2 },
        { type: "USER_CREATED", userId: observer.id, targetId: observer.id },
      ],
    });

    const res = await page.request.get("/api/platform/activity?type=ORG_CREATED&pageSize=200");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const activities = body.activities as { type: string }[];
    expect(activities.length).toBeGreaterThanOrEqual(2);
    expect(activities.every((a) => a.type === "ORG_CREATED")).toBe(true);
  });

  test("Filtre staffActor=true retourne uniquement les logs staff", async ({ page }) => {
    const observer = await loginAsStaff(page, {
      role: "STAFF_OBSERVER",
      scope: "activity-filter-staff",
    });
    const { orgId } = await createTestOrgWithOwner({ scope: "act-staff" });

    await getDb().activityLog.createMany({
      data: [
        // staffActor=true : doit etre retourne.
        {
          type: "ORG_UPDATED",
          userId: observer.id,
          orgId,
          staffActor: true,
        },
        // staffActor=false (defaut) : ne doit PAS apparaitre dans le filtre.
        {
          type: "ORG_UPDATED",
          userId: observer.id,
          orgId,
          staffActor: false,
        },
      ],
    });

    const res = await page.request.get(
      `/api/platform/activity?staffActor=true&orgId=${orgId}&pageSize=200`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    const activities = body.activities as { staffActor: boolean }[];
    expect(activities.length).toBeGreaterThan(0);
    expect(activities.every((a) => a.staffActor === true)).toBe(true);
  });

  test("Pagination : seed > 50 logs, page 2 renvoie les suivants", async ({ page }) => {
    const observer = await loginAsStaff(page, {
      role: "STAFF_OBSERVER",
      scope: "activity-pagination",
    });
    const { orgId } = await createTestOrgWithOwner({ scope: "act-page" });

    // Seed 55 logs USER_LOGIN (type peu utilise par les autres specs) pour
    // permettre une vraie pagination scoping. On filtre par orgId pour
    // s'isoler du bruit.
    const seedData = Array.from({ length: 55 }, (_, i) => ({
      type: "USER_LOGIN" as const,
      userId: observer.id,
      orgId,
      details: { idx: i } as object,
    }));
    await getDb().activityLog.createMany({ data: seedData });

    const page1 = await page.request.get(
      `/api/platform/activity?type=USER_LOGIN&orgId=${orgId}&page=1&pageSize=50`,
    );
    expect(page1.status()).toBe(200);
    const body1 = await page1.json();
    expect(body1.activities.length).toBe(50);
    expect(body1.total).toBeGreaterThanOrEqual(55);

    const page2 = await page.request.get(
      `/api/platform/activity?type=USER_LOGIN&orgId=${orgId}&page=2&pageSize=50`,
    );
    expect(page2.status()).toBe(200);
    const body2 = await page2.json();
    expect(body2.activities.length).toBeGreaterThanOrEqual(5);

    // Verifie qu'il n'y a pas de chevauchement entre les deux pages.
    const ids1 = new Set(body1.activities.map((a: { id: string }) => a.id));
    const ids2 = new Set(body2.activities.map((a: { id: string }) => a.id));
    for (const id of ids2) expect(ids1.has(id as string)).toBe(false);
  });

  test("Type invalide -> 400 INVALID_TYPE", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "activity-bad-type" });

    const res = await page.request.get("/api/platform/activity?type=bogus");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_TYPE");
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
});
