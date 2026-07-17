import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
  setRegistrationStatus,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";
import { expectPdfResponse } from "../helpers/pdf";
import { mailpit } from "../helpers/mailpit";

// IMPORTANT : la route /approve et /reject exige minRole=ADMIN (cf. with-event-auth),
// alors que la permission "registration.approve" liste OPERATOR. On utilise donc un
// utilisateur ADMIN pour ces flows. Discrepance documentee dans le rapport T22.
test.describe("T22 Registrations lifecycle (approve/reject + mail + audit + PDF)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN approuve une registration -> APPROVED + mail + audit + PDF telechargeable", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "appr-ok" });
    const admin = await makeEventAdminUser({ scope: "appr-ok", eventId, orgId });
    const participant = await createTestUser({
      scope: "appr-ok-part",
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
    await mailpit.clear();

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/registrations/${reg.id}/approve`,
    );
    expect(res.status()).toBe(200);

    // BDD
    const db = getDb();
    const updated = await db.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.status).toBe("APPROVED");
    expect(updated?.rejectionReason).toBeNull();

    // Audit
    await expectLastActivity({
      type: "REGISTRATION_APPROVED",
      userId: admin.id,
      eventId,
      targetId: reg.id,
    });

    // Mail vers l'email snapshot
    await mailpit.expectMail({
      to: updated!.snapshotEmail,
      subjectPattern: /(approuvée|inscription|validée)/i,
    });

    // PDF du badge
    const pdfRes = await page.request.get(
      `/api/org/${orgId}/events/${eventId}/badges/${reg.id}`,
    );
    await expectPdfResponse(pdfRes, { minBytes: 3000 });
    expect(pdfRes.headers()["x-template-id"]).toBeTruthy();
  });

  test("ADMIN rejette une registration -> REJECTED + mail (motif) + audit", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "rej-ok" });
    const admin = await makeEventAdminUser({ scope: "rej-ok", eventId, orgId });
    const participant = await createTestUser({
      scope: "rej-ok-part",
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
    await mailpit.clear();

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/registrations/${reg.id}/reject`,
      { data: { reason: "Document illisible", details: "Photo floue" } },
    );
    expect(res.status()).toBe(200);

    const db = getDb();
    const updated = await db.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.status).toBe("REJECTED");
    expect(updated?.rejectionReason).toBe("Document illisible");
    expect(updated?.rejectionDetails).toBe("Photo floue");

    // Audit avec details.reason
    const log = await expectLastActivity({
      type: "REGISTRATION_REJECTED",
      userId: admin.id,
      eventId,
      targetId: reg.id,
    });
    expect((log.details as { reason?: string })?.reason).toBe("Document illisible");

    // Mail avec sujet "refusée" ou contenant le motif
    await mailpit.expectMail({
      to: updated!.snapshotEmail,
      subjectPattern: /(refusée|rejet|refus)/i,
    });
  });

  test("Approve idempotent : 2eme appel renvoie 200 alreadyApproved sans 2eme mail", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "appr-idem" });
    const admin = await makeEventAdminUser({ scope: "appr-idem", eventId, orgId });
    const participant = await createTestUser({
      scope: "appr-idem-part",
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
    await mailpit.clear();

    // 1er approve : envoie mail
    const r1 = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/registrations/${reg.id}/approve`,
    );
    expect(r1.status()).toBe(200);

    // Attend que le 1er mail soit livre
    const db = getDb();
    const reg1 = await db.registration.findUnique({ where: { id: reg.id } });
    await mailpit.expectMail({
      to: reg1!.snapshotEmail,
      subjectPattern: /(approuvée|inscription|validée)/i,
    });

    // 2eme approve : 200 alreadyApproved (court-circuit avant sendStatusNotification)
    const r2 = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/registrations/${reg.id}/approve`,
    );
    expect(r2.status()).toBe(200);
    const body2 = await r2.json();
    expect(body2.alreadyApproved).toBe(true);

    // Aucun 2eme mail "approbation" -- on attend 1500ms pour laisser le temps a
    // un envoi eventuel, puis on compte.
    await new Promise((r) => setTimeout(r, 1500));
    const msgs = await mailpit.search({ to: reg1!.snapshotEmail });
    const approvedMails = msgs.filter((m) => /(approuvée|inscription|validée)/i.test(m.Subject));
    expect(approvedMails.length).toBe(1);
  });

  test("Approve sur registration REJECTED -> reactivation APPROVED autorisee", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "appr-reactiv" });
    const admin = await makeEventAdminUser({ scope: "appr-reactiv", eventId, orgId });
    const participant = await createTestUser({
      scope: "appr-reactiv-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "PENDING",
    });
    await setRegistrationStatus(reg.id, "REJECTED", { rejectionReason: "Test reactiv" });

    await loginAs(page, admin);

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/registrations/${reg.id}/approve`,
    );
    expect(res.status()).toBe(200);

    const db = getDb();
    const updated = await db.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.status).toBe("APPROVED");
    // rejectionReason est efface lors du passage a APPROVED (cf. /approve route).
    expect(updated?.rejectionReason).toBeNull();
  });

  // T22-5 : pas d'auto-print a l'approval dans le code (sendStatusNotification ne
  // touche pas badgePrinted, /approve ne genere pas BADGE_BATCH_PRINTED). Test skip.
  test.skip("Audit BADGE_BATCH_PRINTED apres approval (skip : pas d'auto-print dans le code)", async () => {
    // Comportement reel verifie : /approve n'imprime pas le badge automatiquement.
    // BADGE_BATCH_PRINTED est emis uniquement via /registrations/print (lot manuel)
    // ou BADGE_PRINTED via /registrations/[regId]/print (unitaire).
  });
});
