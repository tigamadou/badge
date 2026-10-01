import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  makeEventAdminUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";

type ActivityLogResponseItem = {
  id: string;
  type: string;
  details: Record<string, unknown> | null;
  staffActor: boolean;
  createdAt: string;
  targetId: string | null;
  user: { name: string; email: string } | null;
};

// Page Journal — /event/[eventId]/activity et /event/[eventId]/activity/[logId]
// Rôles : STAFF/ADMIN voient tout ; OPERATOR ne voit que ses propres BADGE_SCANNED
// (filtre serveur). Lecture seule. La reponse ne doit jamais contenir de PII
// (snapshotEmail / Phone / Document).
test.describe("Event — Journal", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });






  // --- Rendu des pages ----------------------------------------------------

  test("ADMIN voit la page Journal", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "act-page" });
    const admin = await makeEventAdminUser({ scope: "act-page", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/activity`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/activity$`));
    await expect(page.getByRole("heading", { name: /journal d'activité/i })).toBeVisible();
  });

  test("ADMIN voit le detail d'une entree", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "act-page-detail" });
    const admin = await makeEventAdminUser({ scope: "act-page-detail", eventId, orgId });
    const log = await getDb().activityLog.create({
      data: { type: "REGISTRATION_CREATED", eventId, userId: admin.id },
    });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/activity/${log.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/activity/${log.id}`));
    // describeActivity("REGISTRATION_CREATED") => "Inscription créée" (h1).
    await expect(page.getByRole("heading", { name: /inscription créée/i })).toBeVisible();
  });

  test("Etat vide : aucune activite", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "act-empty" });
    const admin = await makeEventAdminUser({ scope: "act-empty", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/activity`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/activity$`));
    await expect(page.getByText(/aucune activité/i)).toBeVisible();
  });
});
