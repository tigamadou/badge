import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestRegistration,
  createTestUser,
  disconnectDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

test.describe("T25 Scan & check-in (verify + checkin per regId)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("Scan d'une registration APPROVED -> ok + audit result=ok", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "scan-ok" });
    const operator = await createTestEventMember({
      scope: "scan-ok",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    const participant = await createTestUser({
      scope: "scan-ok-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "APPROVED",
    });

    await loginAs(page, operator);
    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/scan/verify`,
      { data: { payload: `https://app.test/verify/${reg.id}` } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.authorized).toBe(true);

    const log = await expectLastActivity({
      type: "BADGE_SCANNED",
      userId: operator.id,
      eventId,
      targetId: reg.id,
    });
    expect((log.details as { result?: string })?.result).toBe("ok");
  });

  test("Scan d'une registration REJECTED -> authorized=false + audit result=denied-REJECTED", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "scan-rej" });
    const operator = await createTestEventMember({
      scope: "scan-rej",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    const participant = await createTestUser({
      scope: "scan-rej-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "REJECTED",
    });

    await loginAs(page, operator);
    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/scan/verify`,
      { data: { payload: reg.id } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);

    const log = await expectLastActivity({
      type: "BADGE_SCANNED",
      userId: operator.id,
      eventId,
      targetId: reg.id,
    });
    expect((log.details as { result?: string })?.result).toBe("denied-REJECTED");
  });

  test("Scan d'une registration PENDING -> authorized=false + audit result=denied-PENDING", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "scan-pend" });
    const operator = await createTestEventMember({
      scope: "scan-pend",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    const participant = await createTestUser({
      scope: "scan-pend-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "PENDING",
    });

    await loginAs(page, operator);
    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/scan/verify`,
      { data: { payload: reg.id } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);

    const log = await expectLastActivity({
      type: "BADGE_SCANNED",
      userId: operator.id,
      eventId,
      targetId: reg.id,
    });
    expect((log.details as { result?: string })?.result).toBe("denied-PENDING");
  });

  test("Scan d'une registration d'un autre event -> 404 FOREIGN_EVENT + audit", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "scan-foreign-host" });
    const foreign = await createTestEvent({ scope: "scan-foreign-other" });
    const operator = await createTestEventMember({
      scope: "scan-foreign",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    const participant = await createTestUser({
      scope: "scan-foreign-part",
      verified: true,
      profile: true,
    });
    const foreignReg = await createTestRegistration({
      eventId: foreign.eventId,
      userId: participant.id,
      categoryId: foreign.categoryId,
      status: "APPROVED",
    });

    await loginAs(page, operator);
    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/scan/verify`,
      { data: { payload: foreignReg.id } },
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("FOREIGN_EVENT");

    const log = await expectLastActivity({
      type: "BADGE_SCANNED",
      userId: operator.id,
      eventId,
      targetId: foreignReg.id,
    });
    expect((log.details as { result?: string })?.result).toBe("foreign-event");
  });

  test("Scan d'un badgeId inexistant -> 404 NOT_FOUND + audit result=not-found", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "scan-notfound" });
    const operator = await createTestEventMember({
      scope: "scan-notfound",
      orgId,
      eventId,
      role: "OPERATOR",
    });

    await loginAs(page, operator);
    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/scan/verify`,
      { data: { payload: "BADGE-INEXISTANT-XYZ" } },
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");

    const log = await expectLastActivity({
      type: "BADGE_SCANNED",
      userId: operator.id,
      eventId,
    });
    expect((log.details as { result?: string })?.result).toBe("not-found");
  });

  test("Check-in direct par regId (POST /registrations/[regId]/checkin) -> 200 + audit BADGE_SCANNED", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "checkin-direct" });
    const operator = await createTestEventMember({
      scope: "checkin-direct",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    const participant = await createTestUser({
      scope: "checkin-direct-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "APPROVED",
    });

    await loginAs(page, operator);
    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/registrations/${reg.id}/checkin`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(true);

    await expectLastActivity({
      type: "BADGE_SCANNED",
      userId: operator.id,
      eventId,
      targetId: reg.id,
    });
  });

  test("Payload malforme (vide) -> 400 VALIDATION", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "scan-malformed" });
    const operator = await createTestEventMember({
      scope: "scan-malformed",
      orgId,
      eventId,
      role: "OPERATOR",
    });

    await loginAs(page, operator);
    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/scan/verify`,
      { data: { payload: "" } },
    );
    expect(res.status()).toBe(400);
  });
});
