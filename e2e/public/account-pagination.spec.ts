import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestOrgWithOwner, createTestUser, disconnectDb, getDb } from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectNoHorizontalOverflow, expectPagination } from "../helpers/pagination";

test.describe("Compte participant — pagination des inscriptions", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("25 inscriptions : 10 cartes, puis 10 et 5 sur les pages 2 et 3, sans débordement à 375 px", async ({ page }) => {
    const db = getDb();
    const stamp = Date.now();
    const { orgId } = await createTestOrgWithOwner({ scope: "pg-acc" });
    const user = await createTestUser({ scope: "pg-acc-user", verified: true, profile: true });
    const ids = Array.from({ length: 25 }, (_, i) => i);
    await db.event.createMany({
      data: ids.map((i) => ({
        id: `e2e-pgacc-${stamp}-${i}`,
        orgId,
        title: `Pg salon ${i}`,
        slug: `e2e-pgacc-${stamp}-${i}`,
        location: "Abidjan",
        date: new Date(Date.now() + (i + 1) * 24 * 3600 * 1000),
      })),
    });
    await db.category.createMany({
      data: ids.map((i) => ({ id: `e2e-pgacc-c-${stamp}-${i}`, eventId: `e2e-pgacc-${stamp}-${i}`, name: "Visiteur", color: "#336699", number: 1 })),
    });
    await db.registration.createMany({
      data: ids.map((i) => ({
        id: `E2E-PGACC-${stamp}-${String(i).padStart(2, "0")}`,
        userId: user.id,
        eventId: `e2e-pgacc-${stamp}-${i}`,
        categoryId: `e2e-pgacc-c-${stamp}-${i}`,
        status: "PENDING" as const,
        snapshotFirstName: "Awa",
        snapshotLastName: "Diallo",
        snapshotEmail: user.email,
        snapshotStructure: "S",
        snapshotPhoto: "uploads/e2e/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: `PG-${i}`,
        snapshotIdDocument: "uploads/e2e/doc.pdf",
      })),
    });

    await loginAs(page, user);
    await page.goto("/account");
    await expect(page.locator('a[href^="/account/registrations/"]')).toHaveCount(10);
    await expectPagination(page, { total: 25, pageSize: 10 });
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator('a[href^="/account/registrations/"]')).toHaveCount(10);
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page).toHaveURL(/page=3/);
    await expect(page.locator('a[href^="/account/registrations/"]')).toHaveCount(5);

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/account");
    await expectNoHorizontalOverflow(page);
  });
});
