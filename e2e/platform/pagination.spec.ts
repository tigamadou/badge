import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestPrintRequest,
  createTestStaff,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { cleanupTestEmailJobs, createTestEmailJob } from "../helpers/jobs";
import { loginAndEnter } from "../helpers/nav";
import { expectNoHorizontalOverflow, expectPagination, seedMany, selectPageSize } from "../helpers/pagination";

const EMAIL_SUFFIX = "@v2-11-e2e.test";

// Pagination des listes de l'espace plateforme (page / pageSize dans l'URL). Les listes sont
// globales : chaque test les restreint par un filtre portant un repere unique.
test.describe("Platform — Pagination des listes", () => {
  const jobRecipients = `e2e-pg-jobs-${Date.now()}`;

  test.afterAll(async () => {
    await cleanupTestEmailJobs(jobRecipients);
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("Organisations : taille, filtre + page, page hors bornes, sous-page membres", async ({ page }) => {
    const stamp = `pgorg${Date.now()}`;
    const db = getDb();
    await db.organization.createMany({
      data: Array.from({ length: 45 }, (_, i) => ({
        name: `${stamp} Org ${String(i).padStart(2, "0")}`,
        slug: `e2e-${stamp}-${i}`,
      })),
    });
    const staff = await createTestStaff({ scope: "pg-org", role: "STAFF_ADMIN" });
    await loginAndEnter(page, staff, { kind: "platform" });

    await page.getByRole("link", { name: /^organisations/i }).first().click();
    await expect(page).toHaveURL(/\/platform\/organizations/);
    await page.getByPlaceholder(/rechercher une organisation/i).fill(stamp);
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page).toHaveURL(new RegExp(`q=${stamp}`));
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expectPagination(page, { total: 45, pageSize: 20 });

    await selectPageSize(page, 10);
    await expect(page.locator("tbody tr")).toHaveCount(10);
    await expect(page).toHaveURL(new RegExp(`q=${stamp}`));
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page).toHaveURL(/page=2/);

    // Soumettre le filtre depuis la page 2 : retour page 1, taille conservée.
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page).not.toHaveURL(/page=/);
    await expect(page).toHaveURL(/pageSize=10/);
    await expectPagination(page, { total: 45, pageSize: 10 });

    await page.goto(`/platform/organizations?q=${stamp}&pageSize=10&page=99`);
    await expectPagination(page, { total: 45, pageSize: 10, page: 5 });
    await expect(page.locator("tbody tr")).toHaveCount(5);

    // Sous-page membres d'une organisation : 25 membres.
    const org = await db.organization.findFirstOrThrow({ where: { slug: `e2e-${stamp}-0` } });
    const emails = Array.from({ length: 25 }, (_, i) => `e2e-${stamp}-m${i}${EMAIL_SUFFIX}`);
    await db.user.createMany({ data: emails.map((email) => ({ email, password: "x", name: "E2E Membre" })) });
    const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    await db.orgMembership.createMany({ data: users.map((u) => ({ userId: u.id, orgId: org.id, role: "AUDITOR" as const })) });
    await page.goto(`/platform/organizations/${org.id}/members`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(5);
    await expectNoHorizontalOverflow(page);
  });

  test("Utilisateurs et profils : filtres, taille de page, page hors bornes", async ({ page }) => {
    const stamp = `pgusr${Date.now()}`;
    const db = getDb();
    await db.user.createMany({
      data: Array.from({ length: 45 }, (_, i) => ({
        email: `e2e-${stamp}-${i}${EMAIL_SUFFIX}`,
        password: "x",
        name: `${stamp} User ${String(i).padStart(2, "0")}`,
        firstName: "Awa",
        lastName: `${stamp}${String(i).padStart(2, "0")}`,
        idDocumentType: "CNI",
        idDocumentNumber: `PG-${stamp}-${i}`,
        profileStatus: "PENDING" as const,
      })),
    });
    const staff = await createTestStaff({ scope: "pg-usr", role: "STAFF_ADMIN" });
    await loginAndEnter(page, staff, { kind: "platform" });

    await page.goto(`/platform/users?q=${stamp}`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expectPagination(page, { total: 45, pageSize: 20 });
    await selectPageSize(page, 50);
    await expect(page.locator("tbody tr")).toHaveCount(45);

    await page.goto(`/platform/profiles?status=PENDING&q=${stamp}`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expectPagination(page, { total: 45, pageSize: 20 });
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await page.goto(`/platform/profiles?status=PENDING&q=${stamp}&page=99`);
    await expectPagination(page, { total: 45, pageSize: 20, page: 3 });
    await expect(page.locator("tbody tr")).toHaveCount(5);

    for (const width of [375, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/platform/users?q=${stamp}`);
      await expect(page.locator("tbody tr")).toHaveCount(20);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("Emails (jobs) et journal : pagination et tailles communes", async ({ page }) => {
    const db = getDb();
    await seedMany(23, (i) =>
      createTestEmailJob({
        to: `${jobRecipients}-${i}@x.test`,
        kind: "e2e.pagination",
        status: "FAILED",
        subject: "Pagination",
        html: "<p>x</p>",
      }),
    );
    const { orgId } = await createTestEvent({ scope: "pg-journal" });
    await db.activityLog.createMany({
      data: Array.from({ length: 23 }, () => ({ type: "ORG_UPDATED" as const, orgId })),
    });
    const staff = await createTestStaff({ scope: "pg-jobs", role: "STAFF_ADMIN" });
    await loginAndEnter(page, staff, { kind: "platform" });

    await page.goto(`/platform/jobs?q=${jobRecipients}`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expectPagination(page, { total: 23, pageSize: 20 });
    await selectPageSize(page, 10);
    await expect(page).toHaveURL(new RegExp(`q=${jobRecipients}`));
    await expect(page.locator("tbody tr")).toHaveCount(10);
    await page.goto(`/platform/jobs?q=${jobRecipients}&pageSize=10&page=99`);
    await expectPagination(page, { total: 23, pageSize: 10, page: 3 });
    await expect(page.locator("tbody tr")).toHaveCount(3);

    await page.goto(`/platform/activity?orgId=${orgId}`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expectPagination(page, { total: 23, pageSize: 20 });
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(3);
  });

  test("Commandes d'impression : taille, filtre statut + page, page hors bornes", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "pg-orders" });
    const organizer = await createTestUser({ scope: "pg-orders-org", verified: true });
    await seedMany(23, (i) =>
      createTestPrintRequest({
        eventId,
        orgId,
        createdById: organizer.id,
        status: i < 3 ? "QUOTED" : "SUBMITTED",
        lines: [{ label: "Support badge PVC", quantity: 10, unitPrice: 1500, kind: "PRODUCT" }],
      }),
    );
    const staff = await createTestStaff({ scope: "pg-orders", role: "STAFF_ADMIN" });
    await loginAndEnter(page, staff, { kind: "platform" });

    await page.goto(`/platform/print/orders?orgId=${orgId}`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expectPagination(page, { total: 23, pageSize: 20 });
    await selectPageSize(page, 10);
    await expect(page).toHaveURL(new RegExp(`orgId=${orgId}`));
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page).toHaveURL(/page=2/);

    // Filtre de statut soumis depuis la page 2 : retour page 1, taille conservée.
    await page.getByLabel("Statut").selectOption("QUOTED");
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page).not.toHaveURL(/page=/);
    await expect(page).toHaveURL(/pageSize=10/);
    await expect(page.locator("tbody tr")).toHaveCount(3);

    await page.goto(`/platform/print/orders?orgId=${orgId}&page=99`);
    await expectPagination(page, { total: 23, pageSize: 20, page: 2 });
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await page.goto("/platform/print/orders?pageSize=abc");
    await expect(page.getByLabel("Nombre de résultats par page")).toHaveValue("20");
  });
});
