import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestRegistration,
  createTestStaff,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs, loginAsEventMember, loginAsOrgMember } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

// Setup commun reutilise par plusieurs tests : 1 event + 1 user verifie avec profil
// complet pour fabriquer une registration, plus 1 categorie supplementaire.
async function setupEventWithRegistration(scope: string) {
  const { orgId, eventId, eventSlug, categoryId } = await createTestEvent({ scope });
  const subject = await createTestUser({
    scope: `${scope}-subject`,
    verified: true,
    profile: true,
  });
  const reg = await createTestRegistration({
    eventId,
    userId: subject.id,
    categoryId,
    status: "PENDING",
  });
  return { orgId, eventId, eventSlug, categoryId, regId: reg.id, subject };
}

test.describe("Event RBAC matrix (ADMIN / OPERATOR / PRINTER / VIEWER)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // ---------------- OPERATOR (8 actions interdites) ----------------

  test("OPERATOR cannot create a manual registration (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-op-reg-create");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "OPERATOR",
      scope: "rbac-op-reg-create",
    });
    const target = await createTestUser({
      scope: "rbac-op-target",
      verified: true,
      profile: true,
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations`,
      { data: { userId: target.id, categoryId: ctx.categoryId } },
    );
    expect(res.status()).toBe(403);
  });

  test("OPERATOR cannot delete a registration (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-op-reg-del");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "OPERATOR",
      scope: "rbac-op-reg-del",
    });
    const res = await page.request.delete(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations/${ctx.regId}`,
    );
    expect(res.status()).toBe(403);
  });

  test("OPERATOR cannot block an email (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-op-block");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "OPERATOR",
      scope: "rbac-op-block",
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations/${ctx.regId}/block-email`,
      { data: {} },
    );
    expect(res.status()).toBe(403);
  });

  test("OPERATOR cannot export registrations (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-op-export");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "OPERATOR",
      scope: "rbac-op-export",
    });
    const res = await page.request.get(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations/export`,
    );
    expect(res.status()).toBe(403);
  });

  test("OPERATOR cannot create a category (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-op-cat");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "OPERATOR",
      scope: "rbac-op-cat",
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/categories`,
      { data: { name: "VIP", color: "#ff0000", number: 99 } },
    );
    expect(res.status()).toBe(403);
  });

  test("OPERATOR cannot invite a member (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-op-invite");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "OPERATOR",
      scope: "rbac-op-invite",
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/members`,
      { data: { email: `nope-${Date.now()}@v2-11-e2e.test`, role: "VIEWER" } },
    );
    expect(res.status()).toBe(403);
  });

  test("OPERATOR cannot PATCH event settings (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-op-settings");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "OPERATOR",
      scope: "rbac-op-settings",
    });
    const res = await page.request.patch(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/settings`,
      { data: { contactEmail: "x@x.test" } },
    );
    expect(res.status()).toBe(403);
  });

  test("OPERATOR cannot archive event (403 requires org OWNER)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-op-archive");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "OPERATOR",
      scope: "rbac-op-archive",
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/archive`,
    );
    expect(res.status()).toBe(403);
  });

  // ---------------- PRINTER (3 actions interdites) ----------------

  test("PRINTER cannot scan/verify (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-printer-scan");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "PRINTER",
      scope: "rbac-printer-scan",
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/scan/verify`,
      { data: { payload: ctx.regId } },
    );
    expect(res.status()).toBe(403);
  });

  test("PRINTER cannot GET registration detail (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-printer-detail");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "PRINTER",
      scope: "rbac-printer-detail",
    });
    const res = await page.request.get(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations/${ctx.regId}`,
    );
    expect(res.status()).toBe(403);
  });

  test("PRINTER cannot approve registration (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-printer-approve");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "PRINTER",
      scope: "rbac-printer-approve",
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations/${ctx.regId}/approve`,
    );
    expect(res.status()).toBe(403);
  });

  // ---------------- VIEWER (3 actions interdites) ----------------

  test("VIEWER cannot approve registration (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-viewer-approve");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "VIEWER",
      scope: "rbac-viewer-approve",
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations/${ctx.regId}/approve`,
    );
    expect(res.status()).toBe(403);
  });

  test("VIEWER cannot scan/verify (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-viewer-scan");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "VIEWER",
      scope: "rbac-viewer-scan",
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/scan/verify`,
      { data: { payload: ctx.regId } },
    );
    expect(res.status()).toBe(403);
  });

  test("VIEWER cannot GET registration detail (403)", async ({ page }) => {
    const ctx = await setupEventWithRegistration("rbac-viewer-detail");
    await loginAsEventMember(page, {
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      role: "VIEWER",
      scope: "rbac-viewer-detail",
    });
    const res = await page.request.get(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations/${ctx.regId}`,
    );
    expect(res.status()).toBe(403);
  });
});

test.describe("Event RBAC inheritance (org -> event)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("OWNER org (no event membership) can approve as effective ADMIN", async ({
    page,
  }) => {
    const ctx = await setupEventWithRegistration("rbac-inherit-owner");
    // Login OWNER org -- pas d'EventMembership.
    await loginAsOrgMember(page, {
      orgId: ctx.orgId,
      role: "OWNER",
      scope: "rbac-inherit-owner",
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations/${ctx.regId}/approve`,
    );
    expect(res.status()).toBe(200);
    const fresh = await getDb().registration.findUnique({
      where: { id: ctx.regId },
    });
    expect(fresh?.status).toBe("APPROVED");
  });

  test("MANAGER org (no event membership) can approve as effective ADMIN", async ({
    page,
  }) => {
    const ctx = await setupEventWithRegistration("rbac-inherit-manager");
    await loginAsOrgMember(page, {
      orgId: ctx.orgId,
      role: "MANAGER",
      scope: "rbac-inherit-manager",
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations/${ctx.regId}/approve`,
    );
    expect(res.status()).toBe(200);
  });

  test("AUDITOR org (no event membership) cannot approve (403, read-only)", async ({
    page,
  }) => {
    const ctx = await setupEventWithRegistration("rbac-inherit-auditor");
    await loginAsOrgMember(page, {
      orgId: ctx.orgId,
      role: "AUDITOR",
      scope: "rbac-inherit-auditor",
    });
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations/${ctx.regId}/approve`,
    );
    expect(res.status()).toBe(403);
  });

  test("Staff without any membership can approve (200) and audit has staffActor=true", async ({
    page,
  }) => {
    const ctx = await setupEventWithRegistration("rbac-inherit-staff");
    const staff = await createTestStaff({
      role: "STAFF_ADMIN",
      scope: "rbac-inherit-staff",
    });
    await loginAs(page, staff);
    const res = await page.request.post(
      `/api/org/${ctx.orgId}/events/${ctx.eventId}/registrations/${ctx.regId}/approve`,
    );
    expect(res.status()).toBe(200);

    const log = await expectLastActivity({
      type: "REGISTRATION_APPROVED",
      userId: staff.id,
      eventId: ctx.eventId,
      targetId: ctx.regId,
    });
    expect(log.staffActor).toBe(true);
  });
});

