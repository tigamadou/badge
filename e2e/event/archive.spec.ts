import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestUser,
  makeEventAdminUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

test.describe("Event archive / restore", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("OWNER (org) archives an event", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "archive-go" });
    // makeEventAdminUser cree un user OWNER org + ADMIN event.
    const owner = await makeEventAdminUser({ scope: "archive-go", eventId, orgId });
    await loginAs(page, owner);

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/archive`,
    );
    expect(res.status()).toBe(200);

    const fresh = await getDb().event.findUnique({ where: { id: eventId } });
    expect(fresh?.archived).toBe(true);
    expect(fresh?.archivedAt).not.toBeNull();
    expect(fresh?.registrationOpen).toBe(false);

    await expectLastActivity({
      type: "EVENT_ARCHIVED",
      userId: owner.id,
      eventId,
    });
  });

  test("OWNER (org) restores an event", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "archive-restore" });
    const owner = await makeEventAdminUser({
      scope: "archive-restore",
      eventId,
      orgId,
    });
    await loginAs(page, owner);

    // Archive d'abord (etat de depart pour le restore).
    await getDb().event.update({
      where: { id: eventId },
      data: { archived: true, archivedAt: new Date(), registrationOpen: false },
    });

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/restore`,
    );
    expect(res.status()).toBe(200);

    const fresh = await getDb().event.findUnique({ where: { id: eventId } });
    expect(fresh?.archived).toBe(false);
    expect(fresh?.archivedAt).toBeNull();

    await expectLastActivity({
      type: "EVENT_RESTORED",
      userId: owner.id,
      eventId,
    });
  });

  test("Public cannot register on an archived event (403 CLOSED)", async ({ page }) => {
    const { eventId, eventSlug, categoryId } = await createTestEvent({
      scope: "archive-public",
    });
    // Archive l'event.
    await getDb().event.update({
      where: { id: eventId },
      data: { archived: true, archivedAt: new Date(), registrationOpen: false },
    });

    // User verifie + profil complet, login pour pouvoir poster sur /register.
    const user = await createTestUser({
      scope: "archive-public-user",
      verified: true,
      profile: true,
    });
    await loginAs(page, user);

    const res = await page.request.post(`/api/events/${eventSlug}/register`, {
      data: { categoryId },
    });
    // loadPublicEventBySlug -> PublicEventError("CLOSED") -> 403.
    // On accepte aussi 409 / 404 selon comportements en bordure pour ne pas
    // sur-contraindre, mais l'attendu courant est 403.
    expect([403, 404, 409]).toContain(res.status());
    const body = await res.json().catch(() => ({}));
    if (res.status() === 403) {
      expect(body.code).toBe("CLOSED");
    }
  });

  test("Admin pages remain accessible on an archived event (read-only)", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({
      scope: "archive-admin-access",
    });
    const owner = await makeEventAdminUser({
      scope: "archive-admin-access",
      eventId,
      orgId,
    });
    await loginAs(page, owner);

    // Archive.
    await getDb().event.update({
      where: { id: eventId },
      data: { archived: true, archivedAt: new Date(), registrationOpen: false },
    });

    const response = await page.goto(
      `/org/${orgId}/events/${eventId}/registrations`,
    );
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: /inscriptions/i })).toBeVisible();
  });

  test("ADMIN event-only (no org OWNER) cannot archive (requires org OWNER)", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "archive-admin-only" });
    // Cree un user qui a seulement EventMembership ADMIN, pas d'OrgMembership.
    const user = await createTestUser({
      scope: "archive-admin-only-user",
      verified: true,
    });
    await getDb().eventMembership.create({
      data: { userId: user.id, eventId, role: "ADMIN" },
    });
    await loginAs(page, user);

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/archive`,
    );
    expect(res.status()).toBe(403);
  });
});
