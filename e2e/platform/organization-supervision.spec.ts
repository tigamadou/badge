import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";

// Onglets de supervision d'une org — /platform/organizations/[orgId]/events
// et /platform/organizations/[orgId]/activity.
// Rôle mini : STAFF_OBSERVER. Pages 100% LECTURE SEULE : aucune action, aucun
// filtre. Le journal est limite aux 50 dernieres entrees de l'org.
test.describe("Platform — Supervision d'une organisation", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function mkEvent(orgId: string, title: string) {
    return getDb().event.create({
      data: {
        orgId,
        title,
        slug: `e2e-sup-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        location: "Abidjan",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
  }

  // --- Onglet Evenements --------------------------------------------------

  test("STAFF_OBSERVER voit les evenements de l'org", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "psup-events" });
    await mkEvent(orgId, "Event Supervision E2E");
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "psup-events-staff" });

    await page.goto(`/platform/organizations/${orgId}/events`);
    await expect(page.getByText("Event Supervision E2E")).toBeVisible();
  });

  test("Etat vide : aucun evenement", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "psup-events-empty" });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "psup-events-empty-staff" });

    await page.goto(`/platform/organizations/${orgId}/events`);
    await expect(page.getByText(/aucun événement/i)).toBeVisible();
  });

  // --- Onglet Journal -----------------------------------------------------

  test("STAFF_OBSERVER voit le journal de l'org", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "psup-activity" });
    await getDb().activityLog.create({
      data: { type: "ORG_UPDATED", orgId, userId: owner.id, details: { changedFields: ["name"] } },
    });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "psup-activity-staff" });

    await page.goto(`/platform/organizations/${orgId}/activity`);
    await expect(page.getByText("ORG_UPDATED").first()).toBeVisible();
  });

  test("Etat vide : aucune entree de journal", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "psup-activity-empty" });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "psup-activity-empty-staff" });

    await page.goto(`/platform/organizations/${orgId}/activity`);
    await expect(page.getByText(/aucune entrée/i)).toBeVisible();
  });

  test("Le journal est scope a l'organisation consultee", async ({ page }) => {
    const { orgId: orgA } = await createTestOrgWithOwner({ scope: "psup-scope-a" });
    const { orgId: orgB, owner: ownerB } = await createTestOrgWithOwner({ scope: "psup-scope-b" });
    // Une entree qui appartient a l'org B uniquement.
    await getDb().activityLog.create({
      data: { type: "ORG_ARCHIVED", orgId: orgB, userId: ownerB.id },
    });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "psup-scope-staff" });

    await page.goto(`/platform/organizations/${orgA}/activity`);
    await expect(page.getByText("ORG_ARCHIVED")).toHaveCount(0);
  });
});
