import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";

test.describe("Staff > journal d'activite", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("STAFF_OBSERVER consulte le journal global", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "activity-observer" });

    await page.goto("/staff/activity");
    await expect(
      page.getByRole("heading", { name: /journal d'activite/i }),
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

    const res = await page.request.get("/api/staff/activity?type=ORG_CREATED&pageSize=200");
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
      `/api/staff/activity?staffActor=true&orgId=${orgId}&pageSize=200`,
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
      `/api/staff/activity?type=USER_LOGIN&orgId=${orgId}&page=1&pageSize=50`,
    );
    expect(page1.status()).toBe(200);
    const body1 = await page1.json();
    expect(body1.activities.length).toBe(50);
    expect(body1.total).toBeGreaterThanOrEqual(55);

    const page2 = await page.request.get(
      `/api/staff/activity?type=USER_LOGIN&orgId=${orgId}&page=2&pageSize=50`,
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

    const res = await page.request.get("/api/staff/activity?type=bogus");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_TYPE");
  });
});
