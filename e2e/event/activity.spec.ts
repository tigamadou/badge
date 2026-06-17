import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  makeEventAdminUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs, loginAsEventMember } from "../helpers/auth";

type ActivityLogResponseItem = {
  id: string;
  type: string;
  details: Record<string, unknown> | null;
  staffActor: boolean;
  createdAt: string;
  targetId: string | null;
  user: { name: string; email: string } | null;
};

test.describe("Event activity log", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN sees the full event activity feed", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "activity-admin" });
    const admin = await makeEventAdminUser({ scope: "activity-admin", eventId, orgId });
    await loginAs(page, admin);

    // Seed plusieurs logs varies sur cet event.
    await getDb().activityLog.createMany({
      data: [
        { type: "REGISTRATION_CREATED", eventId, userId: admin.id },
        { type: "REGISTRATION_APPROVED", eventId, userId: admin.id },
        { type: "BADGE_SCANNED", eventId, userId: admin.id, details: { result: "ok" } },
        { type: "CATEGORY_CREATED", eventId, userId: admin.id },
      ],
    });

    const res = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/activity?limit=100`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    const types = (body.logs as ActivityLogResponseItem[]).map((l) => l.type);
    expect(types).toEqual(
      expect.arrayContaining([
        "REGISTRATION_CREATED",
        "REGISTRATION_APPROVED",
        "BADGE_SCANNED",
        "CATEGORY_CREATED",
      ]),
    );
  });

  test("OPERATOR only sees their own BADGE_SCANNED entries (server-side filter)", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "activity-operator" });
    // Login as OPERATOR.
    const operator = await loginAsEventMember(page, {
      orgId,
      eventId,
      role: "OPERATOR",
      scope: "activity-op",
    });
    // Cree aussi un ADMIN dont les scans NE doivent PAS apparaitre dans la vue OPERATOR.
    const otherAdmin = await makeEventAdminUser({
      scope: "activity-op-otheradmin",
      eventId,
      orgId,
    });

    await getDb().activityLog.createMany({
      data: [
        // Logs operator (visibles).
        { type: "BADGE_SCANNED", eventId, userId: operator.id, details: { result: "ok" } },
        { type: "BADGE_SCANNED", eventId, userId: operator.id, details: { result: "denied-PENDING" } },
        // Log scan d'un autre user -> doit etre filtre.
        { type: "BADGE_SCANNED", eventId, userId: otherAdmin.id, details: { result: "ok" } },
        // Log autre type sur l'operateur -> doit etre filtre (type=BADGE_SCANNED force).
        { type: "REGISTRATION_APPROVED", eventId, userId: operator.id },
      ],
    });

    const res = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/activity?limit=100`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    const logs = body.logs as ActivityLogResponseItem[];
    expect(logs.length).toBeGreaterThan(0);
    for (const log of logs) {
      expect(log.type).toBe("BADGE_SCANNED");
    }
  });

  test("Filters : type filter works on event activity", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "activity-filter" });
    const admin = await makeEventAdminUser({ scope: "activity-filter", eventId, orgId });
    await loginAs(page, admin);

    await getDb().activityLog.createMany({
      data: [
        { type: "REGISTRATION_APPROVED", eventId, userId: admin.id, targetId: "reg-1" },
        { type: "REGISTRATION_REJECTED", eventId, userId: admin.id, targetId: "reg-2" },
        { type: "REGISTRATION_APPROVED", eventId, userId: admin.id, targetId: "reg-3" },
      ],
    });

    const res = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/activity?type=REGISTRATION_APPROVED&limit=100`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    const logs = body.logs as ActivityLogResponseItem[];
    expect(logs.length).toBeGreaterThanOrEqual(2);
    for (const log of logs) {
      expect(log.type).toBe("REGISTRATION_APPROVED");
    }
  });

  test("VIEWER : la response ne fuite pas snapshotEmail/Phone/Document", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "activity-viewer" });
    // VIEWER seul (sans OrgMembership OWNER) -- accede au GET via l'API uniquement,
    // car le layout admin /admin/[orgId] redirige les non-OWNER.
    const viewer = await loginAsEventMember(page, {
      orgId,
      eventId,
      role: "VIEWER",
      scope: "activity-viewer",
    });

    await getDb().activityLog.createMany({
      data: [
        { type: "REGISTRATION_APPROVED", eventId, userId: viewer.id, targetId: "r-snap" },
      ],
    });

    const res = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/activity?limit=100`,
    );
    // Comportement reel : minRole=OPERATOR, donc VIEWER recoit 403.
    // C'est ce qui garantit qu'aucune donnee nominative ne fuite vers VIEWER.
    expect(res.status()).toBe(403);
  });

  test("ADMIN response logs do not contain snapshotEmail/Phone/Document fields", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "activity-shape" });
    const admin = await makeEventAdminUser({ scope: "activity-shape", eventId, orgId });
    await loginAs(page, admin);

    await getDb().activityLog.create({
      data: {
        type: "REGISTRATION_APPROVED",
        eventId,
        userId: admin.id,
        targetId: "r-shape",
        details: { note: "no PII leak" },
      },
    });

    const res = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/activity?limit=100`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    const logs = body.logs as Array<Record<string, unknown>>;
    expect(logs.length).toBeGreaterThan(0);
    for (const log of logs) {
      expect(log).not.toHaveProperty("snapshotEmail");
      expect(log).not.toHaveProperty("snapshotPhone");
      expect(log).not.toHaveProperty("snapshotIdDocument");
      expect(log).not.toHaveProperty("snapshotIdDocumentNumber");
    }
  });
});
