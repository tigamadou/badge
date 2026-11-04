import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestOrgWithOwner, disconnectDb, getDb } from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { expectNoHorizontalOverflow, expectPagination, selectPageSize } from "../helpers/pagination";

// Pagination des listes de l'espace organisation (page / pageSize dans l'URL).
test.describe("Org — Pagination des listes", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("Événements : 20 par défaut, taille 50, page hors bornes, pas de débordement", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pg-org-ev" });
    const stamp = Date.now();
    await getDb().event.createMany({
      data: Array.from({ length: 45 }, (_, i) => ({
        orgId,
        title: `Pg event ${String(i).padStart(2, "0")}`,
        slug: `e2e-pg-ev-${stamp}-${i}`,
        location: "Abidjan",
        date: new Date(Date.now() + (i + 1) * 24 * 3600 * 1000),
      })),
    });
    await loginAndEnter(page, owner, { kind: "org", id: orgId });
    await page.getByRole("link", { name: /événements/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/events`));

    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expectPagination(page, { total: 45, pageSize: 20 });

    await selectPageSize(page, 50);
    await expect(page.locator("tbody tr")).toHaveCount(45);

    await page.goto(`/org/${orgId}/events?page=99`);
    await expect(page.locator("tbody tr")).toHaveCount(5);
    await expectPagination(page, { total: 45, pageSize: 20, page: 3 });

    // Archiver depuis la liste : la tranche est relue, la ligne reste (archivée) et la page tient.
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Archiver" }).first().click();
    await expect(page.getByText("Archivé").first()).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(5);
    await expectPagination(page, { total: 45, pageSize: 20, page: 3 });

    for (const width of [375, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/org/${orgId}/events`);
      await expect(page.locator("tbody tr")).toHaveCount(20);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("Membres, modèles et journal sont paginés", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pg-org-lists" });
    const db = getDb();
    const stamp = Date.now();
    const emails = Array.from({ length: 24 }, (_, i) => `e2e-pg-org-${stamp}-${i}@v2-11-e2e.test`);
    await db.user.createMany({ data: emails.map((email) => ({ email, password: "x", name: "E2E Membre" })) });
    const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    await db.orgMembership.createMany({ data: users.map((u) => ({ userId: u.id, orgId, role: "AUDITOR" as const })) });
    await db.categoryTemplate.createMany({
      data: Array.from({ length: 22 }, (_, i) => ({ orgId, name: `Pg modele ${i}`, color: "#336699", number: 10 + i })),
    });
    await db.activityLog.createMany({
      data: Array.from({ length: 23 }, () => ({ type: "ORG_UPDATED" as const, orgId, userId: owner.id })),
    });
    await loginAndEnter(page, owner, { kind: "org", id: orgId });

    await page.goto(`/org/${orgId}/members`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expectPagination(page, { total: 25, pageSize: 20 });
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(5);

    await page.goto(`/org/${orgId}/templates`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expectPagination(page, { total: 22, pageSize: 20 });

    await page.goto(`/org/${orgId}/activity`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await selectPageSize(page, 10);
    await expect(page.locator("tbody tr")).toHaveCount(10);
    await page.goto(`/org/${orgId}/activity?pageSize=10&page=99`);
    await expectPagination(page, { total: 23, pageSize: 10, page: 3 });
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await expectNoHorizontalOverflow(page);
  });
});
