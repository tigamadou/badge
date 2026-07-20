import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestOrgMember,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

// Page Journal — /org/[orgId]/activity et /org/[orgId]/activity/[logId]
// Rôle mini : AUDITOR (layout). Lecture seule : aucune mutation, aucun filtre UI
// (tri fige createdAt desc, take 100).
test.describe("Org — Journal", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function seedLog(orgId: string, userId: string, staffActor = false) {
    return getDb().activityLog.create({
      data: {
        type: "ORG_UPDATED",
        userId,
        orgId,
        staffActor,
        details: { changedFields: ["name"] },
      },
    });
  }

  // --- Acces & rendu ------------------------------------------------------

  test("OWNER voit le journal et ses entrees", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "act-render" });
    await seedLog(orgId, owner.id);
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/activity`);
    await expect(page.getByRole("heading", { name: /journal d.activité/i })).toBeVisible();
    await expect(page.getByText("ORG_UPDATED").first()).toBeVisible();
  });

  test("AUDITOR voit le journal (role minimal)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "act-aud" });
    const auditor = await createTestOrgMember({
      scope: "act-aud-user",
      orgId,
      role: "AUDITOR",
    });
    await seedLog(orgId, owner.id);
    await loginAs(page, auditor);

    await page.goto(`/org/${orgId}/activity`);
    await expect(page.getByRole("heading", { name: /journal d.activité/i })).toBeVisible();
  });

  test("AUDITOR GET /api/org/[orgId]/activity -> 200", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "act-api" });
    const auditor = await createTestOrgMember({
      scope: "act-api-user",
      orgId,
      role: "AUDITOR",
    });
    await loginAs(page, auditor);

    const res = await page.request.get(`/api/org/${orgId}/activity`);
    expect(res.status()).toBe(200);
  });

  // --- Etats --------------------------------------------------------------

  test("Etat vide : 'Aucune activité.'", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "act-empty" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/activity`);
    await expect(page.getByText("Aucune activité.")).toBeVisible();
  });

  test("Une action staff est marquee du tag 'staff'", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "act-staff" });
    await seedLog(orgId, owner.id, true);
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/activity`);
    await expect(page.getByText("staff").first()).toBeVisible();
  });

  // --- Detail -------------------------------------------------------------

  test("Le chevron mene au detail de l'entree", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "act-detail-nav" });
    const log = await seedLog(orgId, owner.id);
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/activity`);
    await page.getByLabel("Voir le détail").first().click();
    await page.waitForURL(`**/org/${orgId}/activity/${log.id}`);
    await expect(page.getByText("ORG_UPDATED").first()).toBeVisible();
  });

  test("Un log d'une autre org -> 404 (scoping)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "act-scope-a" });
    const { orgId: otherOrgId, owner: otherOwner } = await createTestOrgWithOwner({
      scope: "act-scope-b",
    });
    const foreignLog = await seedLog(otherOrgId, otherOwner.id);
    await loginAs(page, owner);

    const res = await page.goto(`/org/${orgId}/activity/${foreignLog.id}`);
    expect(res?.status()).toBe(404);
  });
});
