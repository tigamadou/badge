import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";
import { expectPdfResponse } from "../helpers/pdf";

// Notes (cf. rapport T24) :
// - La route GET /badges/[badgeId] declare minRole: "VIEWER" puis check
//   hasEventPermission badge.print. Or `requireEventRole(userId, eventId, "VIEWER")`
//   REFUSE un PRINTER pur (hierarchie partielle). Resultat : PRINTER renvoie 403
//   avant meme d'atteindre le check de permission badge.print. On utilise donc
//   ADMIN pour les telechargements PDF en E2E.
// - Les routes /registrations/print (lot) et /registrations/[regId]/print
//   exigent minRole: "ADMIN" -- pas PRINTER. Idem, on utilise ADMIN.
test.describe("T24 Badges print + PDF + template cascade", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN telecharge un PDF individuel (header x-template-id present)", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "pdf-dl" });
    const admin = await makeEventAdminUser({ scope: "pdf-dl", eventId, orgId });
    const participant = await createTestUser({
      scope: "pdf-dl-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "APPROVED",
    });

    await loginAs(page, admin);
    const res = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/badges/${reg.id}`,
    );
    await expectPdfResponse(res, { minBytes: 3000 });
    expect(res.headers()["x-template-id"]).toBeTruthy();
  });

  test("PRINTER pur (sans org membership) est REFUSE sur GET /badges (cf. note discrepance)", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "pdf-printer" });
    const printer = await createTestEventMember({
      scope: "pdf-printer",
      orgId,
      eventId,
      role: "PRINTER",
    });
    const participant = await createTestUser({
      scope: "pdf-printer-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "APPROVED",
    });

    await loginAs(page, printer);
    const res = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/badges/${reg.id}`,
    );
    // requireEventRole VIEWER rejette PRINTER (hierarchie partielle).
    expect(res.status()).toBe(403);
  });

  test("ADMIN marque une registration APPROVED comme imprimee (POST /registrations/print)", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "print-one" });
    const admin = await makeEventAdminUser({ scope: "print-one", eventId, orgId });
    const participant = await createTestUser({
      scope: "print-one-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "APPROVED",
    });

    await loginAs(page, admin);
    const res = await page.request.post(
      `/api/admin/${orgId}/events/${eventId}/registrations/print`,
      { data: { ids: [reg.id] } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.printed).toBe(1);

    const db = getDb();
    const updated = await db.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.badgePrinted).toBe(true);
    expect(updated?.badgePrintedAt).not.toBeNull();

    const log = await expectLastActivity({
      type: "BADGE_BATCH_PRINTED",
      userId: admin.id,
      eventId,
    });
    expect((log.details as { count?: number })?.count).toBe(1);
  });

  test("ADMIN imprime un batch de 3 registrations", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "print-batch" });
    const admin = await makeEventAdminUser({ scope: "print-batch", eventId, orgId });
    await loginAs(page, admin);

    const regs: { id: string }[] = [];
    for (let i = 0; i < 3; i++) {
      const p = await createTestUser({
        scope: `print-batch-p${i}`,
        verified: true,
        profile: true,
      });
      const r = await createTestRegistration({
        eventId,
        userId: p.id,
        categoryId,
        status: "APPROVED",
      });
      regs.push(r);
    }

    const res = await page.request.post(
      `/api/admin/${orgId}/events/${eventId}/registrations/print`,
      { data: { ids: regs.map((r) => r.id) } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.printed).toBe(3);

    const db = getDb();
    const printedCount = await db.registration.count({
      where: { id: { in: regs.map((r) => r.id) }, badgePrinted: true },
    });
    expect(printedCount).toBe(3);

    const log = await expectLastActivity({
      type: "BADGE_BATCH_PRINTED",
      userId: admin.id,
      eventId,
    });
    expect((log.details as { count?: number })?.count).toBe(3);
  });

  test("Print sur PENDING -> skip silencieux (count=0, badge non marque)", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "print-pending" });
    const admin = await makeEventAdminUser({ scope: "print-pending", eventId, orgId });
    const participant = await createTestUser({
      scope: "print-pending-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "PENDING",
    });

    await loginAs(page, admin);
    const res = await page.request.post(
      `/api/admin/${orgId}/events/${eventId}/registrations/print`,
      { data: { ids: [reg.id] } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    // La route filtre status=APPROVED, donc 0 imprime.
    expect(body.printed).toBe(0);

    const db = getDb();
    const updated = await db.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.badgePrinted).toBe(false);
  });

  test("Cascade template Event > Org > Platform : PATCH event.badgeTemplateId change le rendu PDF", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "tpl-cascade" });
    const admin = await makeEventAdminUser({ scope: "tpl-cascade", eventId, orgId });
    const participant = await createTestUser({
      scope: "tpl-cascade-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "APPROVED",
    });

    await loginAs(page, admin);

    // 1. Sans override : header x-template-id provient du fallback (org ou platform).
    const r1 = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/badges/${reg.id}`,
    );
    await expectPdfResponse(r1, { minBytes: 3000 });
    const fallbackId = r1.headers()["x-template-id"];
    expect(fallbackId).toBeTruthy();

    // 2. Override event -> recto-verso-v1.
    const patch = await page.request.patch(
      `/api/admin/${orgId}/events/${eventId}/settings/badge`,
      { data: { badgeTemplateId: "recto-verso-v1" } },
    );
    expect(patch.status()).toBe(200);

    const r2 = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/badges/${reg.id}`,
    );
    await expectPdfResponse(r2, { minBytes: 3000 });
    expect(r2.headers()["x-template-id"]).toBe("recto-verso-v1");

    // 3. Clear override -> retour au fallback initial.
    const patchNull = await page.request.patch(
      `/api/admin/${orgId}/events/${eventId}/settings/badge`,
      { data: { badgeTemplateId: null } },
    );
    expect(patchNull.status()).toBe(200);

    const r3 = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/badges/${reg.id}`,
    );
    await expectPdfResponse(r3, { minBytes: 3000 });
    expect(r3.headers()["x-template-id"]).toBe(fallbackId);
  });
});
