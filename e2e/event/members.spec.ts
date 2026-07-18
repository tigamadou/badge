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
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity } from "../helpers/audit";

test.describe("Event members", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN invites a new user as OPERATOR (creates user + membership + sends mail)", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "members-invite-new" });
    const admin = await makeEventAdminUser({
      scope: "members-invite-new",
      eventId,
      orgId,
    });
    await loginAs(page, admin);

    await mailpit.clear();
    const inviteEmail = `e2e-invite-new-${Date.now()}@v2-11-e2e.test`;

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/members`,
      {
        data: { email: inviteEmail, name: "Mariam Kone", role: "OPERATOR" },
      },
    );
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.membership.role).toBe("OPERATOR");

    // BDD : user + membership crees.
    const created = await getDb().user.findUnique({ where: { email: inviteEmail } });
    expect(created).not.toBeNull();
    expect(created?.inviteToken).not.toBeNull();
    const membership = await getDb().eventMembership.findFirst({
      where: { eventId, userId: created!.id },
    });
    expect(membership?.role).toBe("OPERATOR");

    // Mail d'invitation.
    await mailpit.expectMail({
      to: inviteEmail,
      subjectPattern: /(invitation|événement|evenement)/i,
    });

    // Audit USER_CREATED + MEMBERSHIP_ADDED (scope event).
    await expectLastActivity({
      type: "USER_CREATED",
      userId: admin.id,
      eventId,
      targetId: created!.id,
    });
    const membershipAdded = await expectLastActivity({
      type: "MEMBERSHIP_ADDED",
      userId: admin.id,
      eventId,
      targetId: created!.id,
    });
    const details = membershipAdded.details as { scope?: string } | null;
    expect(details?.scope).toBe("event");
  });

  test("ADMIN invites an existing user (no new user, just membership)", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "members-invite-existing" });
    const admin = await makeEventAdminUser({
      scope: "members-invite-existing",
      eventId,
      orgId,
    });
    await loginAs(page, admin);

    // Pre-existing user.
    const existing = await createTestUser({
      scope: "members-existing",
      verified: true,
    });

    const beforeCount = await getDb().user.count();

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/members`,
      {
        data: { email: existing.email, role: "VIEWER" },
      },
    );
    expect(res.status()).toBe(201);

    // Pas de nouveau user.
    const afterCount = await getDb().user.count();
    expect(afterCount).toBe(beforeCount);

    // Membership creee.
    const membership = await getDb().eventMembership.findFirst({
      where: { eventId, userId: existing.id },
    });
    expect(membership?.role).toBe("VIEWER");
  });

  test("ADMIN removes a membership (DELETE returns 204 + audit)", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "members-remove" });
    const admin = await makeEventAdminUser({
      scope: "members-remove",
      eventId,
      orgId,
    });
    await loginAs(page, admin);

    // Cree un membre a retirer.
    const target = await createTestUser({ scope: "members-target", verified: true });
    const membership = await getDb().eventMembership.create({
      data: { userId: target.id, eventId, role: "PRINTER" },
    });

    const res = await page.request.delete(
      `/api/org/${orgId}/events/${eventId}/members/${membership.id}`,
    );
    expect(res.status()).toBe(204);

    const stillThere = await getDb().eventMembership.findUnique({
      where: { id: membership.id },
    });
    expect(stillThere).toBeNull();

    await expectLastActivity({
      type: "MEMBERSHIP_REMOVED",
      userId: admin.id,
      eventId,
      targetId: target.id,
    });
  });

  test("UI : members page displays table with name/email/role columns", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "members-ui" });
    const admin = await makeEventAdminUser({ scope: "members-ui", eventId, orgId });
    await loginAs(page, admin);

    // Seed quelques membres pour rendre la table non-vide.
    const m1 = await createTestUser({ scope: "ui-m1", verified: true });
    await getDb().eventMembership.create({
      data: { userId: m1.id, eventId, role: "OPERATOR" },
    });

    await page.goto(`/event/${eventId}/members`);
    await expect(page.getByRole("heading", { name: /membres/i })).toBeVisible();
    // En-tetes attendues.
    await expect(page.getByRole("columnheader", { name: /nom/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /rôle/i })).toBeVisible();
    // Ligne du membre seede visible.
    await expect(page.getByText(m1.email)).toBeVisible();
  });
});
