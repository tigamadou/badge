import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  makeEventAdminUser,
  getEventBadgeTemplateId,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

test.describe("Event settings", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN updates event base info (title, location, date, registrationOpen)", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "settings-info" });
    const admin = await makeEventAdminUser({
      scope: "settings-info",
      eventId,
      orgId,
    });
    await loginAs(page, admin);

    const newTitle = "Salon E2E renomme";
    const newLocation = "Yamoussoukro";
    const newDate = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

    const res = await page.request.patch(`/api/org/${orgId}/events/${eventId}`, {
      data: {
        title: newTitle,
        location: newLocation,
        date: newDate,
        registrationOpen: false, // l'event est cree avec registrationOpen=true.
      },
    });
    expect(res.status()).toBe(200);

    const fresh = await getDb().event.findUnique({ where: { id: eventId } });
    expect(fresh?.title).toBe(newTitle);
    expect(fresh?.location).toBe(newLocation);
    expect(fresh?.registrationOpen).toBe(false);

    // Audit EVENT_UPDATED systematique.
    await expectLastActivity({
      type: "EVENT_UPDATED",
      userId: admin.id,
      eventId,
    });
    // Et EVENT_REGISTRATION_CLOSED car on est passe de true a false.
    await expectLastActivity({
      type: "EVENT_REGISTRATION_CLOSED",
      userId: admin.id,
      eventId,
    });
  });

  test("ADMIN sets contact override (contactEmail + contactPhone)", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "settings-contact" });
    const admin = await makeEventAdminUser({
      scope: "settings-contact",
      eventId,
      orgId,
    });
    await loginAs(page, admin);

    const res = await page.request.patch(
      `/api/org/${orgId}/events/${eventId}/settings`,
      {
        data: {
          contactEmail: "contact@e2e-event.test",
          contactPhone: "+225 00 00 00 00",
        },
      },
    );
    expect(res.status()).toBe(200);

    const settings = await getDb().eventSettings.findUnique({ where: { eventId } });
    expect(settings?.contactEmail).toBe("contact@e2e-event.test");
    expect(settings?.contactPhone).toBe("+225 00 00 00 00");

    const log = await expectLastActivity({
      type: "EVENT_SETTINGS_UPDATED",
      userId: admin.id,
      eventId,
    });
    const details = log.details as { changedFields?: string[] } | null;
    expect(details?.changedFields).toEqual(
      expect.arrayContaining(["contactEmail", "contactPhone"]),
    );
  });

  test("ADMIN selects event-level badge template (default-v1)", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "settings-badge-pick" });
    const admin = await makeEventAdminUser({
      scope: "settings-badge-pick",
      eventId,
      orgId,
    });
    await loginAs(page, admin);

    const res = await page.request.patch(
      `/api/org/${orgId}/events/${eventId}/settings/badge`,
      {
        data: { badgeTemplateId: "default-v1" },
      },
    );
    expect(res.status()).toBe(200);

    const persisted = await getEventBadgeTemplateId(eventId);
    expect(persisted).toBe("default-v1");

    const log = await expectLastActivity({
      type: "EVENT_SETTINGS_UPDATED",
      userId: admin.id,
      eventId,
    });
    const details = log.details as { field?: string; value?: string | null } | null;
    expect(details?.field).toBe("badgeTemplateId");
    expect(details?.value).toBe("default-v1");
  });

  test("ADMIN resets badge template to null (heritage)", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "settings-badge-reset" });
    const admin = await makeEventAdminUser({
      scope: "settings-badge-reset",
      eventId,
      orgId,
    });
    await loginAs(page, admin);

    // Pose une valeur d'abord pour pouvoir la reset ensuite.
    await getDb().event.update({
      where: { id: eventId },
      data: { badgeTemplateId: "default-v1" },
    });

    const res = await page.request.patch(
      `/api/org/${orgId}/events/${eventId}/settings/badge`,
      {
        data: { badgeTemplateId: null },
      },
    );
    expect(res.status()).toBe(200);

    const persisted = await getEventBadgeTemplateId(eventId);
    expect(persisted).toBeNull();

    const log = await expectLastActivity({
      type: "EVENT_SETTINGS_UPDATED",
      userId: admin.id,
      eventId,
    });
    const details = log.details as { field?: string; value?: string | null } | null;
    expect(details?.field).toBe("badgeTemplateId");
    expect(details?.value).toBeNull();
  });

  test("SMTP payload is rejected (strict schema)", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "settings-smtp-rejected" });
    const admin = await makeEventAdminUser({
      scope: "settings-smtp-rejected",
      eventId,
      orgId,
    });
    await loginAs(page, admin);

    const res = await page.request.patch(
      `/api/org/${orgId}/events/${eventId}/settings`,
      {
        data: { smtpHost: "smtp.example.com" },
      },
    );
    expect(res.status()).toBe(400);
  });
});
