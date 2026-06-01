import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

test.describe("T23 Registrations admin (create / block / duplicates / all-access / export / delete)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN cree une registration manuelle (statut APPROVED par defaut) + audit", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "admin-create-reg" });
    const admin = await makeEventAdminUser({ scope: "admin-create-reg", eventId, orgId });
    const participant = await createTestUser({
      scope: "admin-create-reg-part",
      verified: true,
      profile: true,
    });
    await loginAs(page, admin);

    const res = await page.request.post(
      `/api/admin/${orgId}/events/${eventId}/registrations`,
      { data: { userId: participant.id, categoryId } },
    );
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.registration.status).toBe("APPROVED");

    await expectLastActivity({
      type: "REGISTRATION_CREATED",
      userId: admin.id,
      eventId,
      targetId: body.registration.id,
    });
  });

  test("ADMIN bloque l'email d'une registration + EMAIL_BLOCKED sur nouvelle inscription", async ({
    page,
  }) => {
    const { orgId, eventId, eventSlug, categoryId } = await createTestEvent({
      scope: "block-email",
    });
    const admin = await makeEventAdminUser({ scope: "block-email", eventId, orgId });
    const participant = await createTestUser({
      scope: "block-email-part",
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
    const blockRes = await page.request.post(
      `/api/admin/${orgId}/events/${eventId}/registrations/${reg.id}/block-email`,
      { data: { reason: "Spam" } },
    );
    expect(blockRes.status()).toBe(201);

    const db = getDb();
    const blocked = await db.blockedEmail.findUnique({
      where: { eventId_email: { eventId, email: participant.email } },
    });
    expect(blocked).not.toBeNull();
    expect(blocked?.reason).toBe("Spam");

    const log = await expectLastActivity({
      type: "REGISTRATION_UPDATED",
      userId: admin.id,
      eventId,
      targetId: reg.id,
    });
    expect((log.details as { action?: string })?.action).toBe("block-email");

    // Logout puis tentative d'inscription avec un user different mais MEME email
    // n'est pas possible (email unique sur User). On utilise un autre profil mais
    // on cree manuellement la blockedEmail check via l'API publique : un user dont
    // l'email matche le blockedEmail ne peut pas s'inscrire.
    //
    // Plus pragmatique : on cree un nouveau user dont l'email matche le blockedEmail
    // serait impossible (unique). On reuse donc le meme user, on supprime sa registration
    // existante, on tente une nouvelle POST publique. Le user-account.create n'est pas
    // necessaire ici ; on s'authentifie comme le participant et on POST.
    await db.registration.delete({ where: { id: reg.id } });

    // Logout du admin
    await page.context().clearCookies();
    await loginAs(page, participant);

    const reRes = await page.request.post(`/api/events/${eventSlug}/register`, {
      data: { categoryId },
    });
    expect(reRes.status()).toBe(409);
    const reBody = await reRes.json();
    expect(reBody.code).toBe("EMAIL_BLOCKED");
  });

  test("ADMIN bloque le document d'une registration", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "block-doc" });
    const admin = await makeEventAdminUser({ scope: "block-doc", eventId, orgId });
    const participant = await createTestUser({
      scope: "block-doc-part",
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
      `/api/admin/${orgId}/events/${eventId}/registrations/${reg.id}/block-document`,
      { data: { reason: "Doc invalide" } },
    );
    expect(res.status()).toBe(201);

    const db = getDb();
    const dbReg = await db.registration.findUnique({ where: { id: reg.id } });
    const blocked = await db.blockedDocument.findUnique({
      where: {
        eventId_documentNumber: {
          eventId,
          documentNumber: dbReg!.snapshotIdDocumentNumber,
        },
      },
    });
    expect(blocked).not.toBeNull();

    const log = await expectLastActivity({
      type: "REGISTRATION_UPDATED",
      userId: admin.id,
      eventId,
      targetId: reg.id,
    });
    expect((log.details as { action?: string })?.action).toBe("block-document");
  });

  test("ADMIN voit les doublons d'une registration", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "dup-ok" });
    const admin = await makeEventAdminUser({ scope: "dup-ok", eventId, orgId });

    // 2 participants avec memes firstName/lastName (= candidat doublon).
    const db = getDb();
    const p1 = await createTestUser({
      scope: "dup-p1",
      verified: true,
      profile: true,
    });
    const p2 = await createTestUser({
      scope: "dup-p2",
      verified: true,
      profile: true,
    });
    // Aligne les snapshots : memes firstName + lastName.
    await db.user.update({
      where: { id: p2.id },
      data: { firstName: "Awa", lastName: "Diallo" },
    });

    const reg1 = await createTestRegistration({
      eventId,
      userId: p1.id,
      categoryId,
      status: "PENDING",
    });
    const reg2 = await createTestRegistration({
      eventId,
      userId: p2.id,
      categoryId,
      status: "PENDING",
    });

    await loginAs(page, admin);
    const res = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/registrations/${reg1.id}/duplicates`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.duplicates)).toBe(true);
    // reg2 doit apparaitre dans les doublons de reg1.
    expect(body.duplicates.some((d: { id: string }) => d.id === reg2.id)).toBe(true);
  });

  test("ADMIN toggle all-access via POST /all-access + audit BADGE_ALL_ACCESS_TOGGLED", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "all-access" });
    const admin = await makeEventAdminUser({ scope: "all-access", eventId, orgId });
    const participant = await createTestUser({
      scope: "all-access-part",
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
      `/api/admin/${orgId}/events/${eventId}/registrations/${reg.id}/all-access`,
      { data: { allAccessGranted: true } },
    );
    expect(res.status()).toBe(200);

    const db = getDb();
    const updated = await db.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.allAccessGranted).toBe(true);

    const log = await expectLastActivity({
      type: "BADGE_ALL_ACCESS_TOGGLED",
      userId: admin.id,
      eventId,
      targetId: reg.id,
    });
    expect((log.details as { value?: boolean })?.value).toBe(true);
  });

  test("ADMIN exporte les inscriptions en CSV + audit BADGE_BATCH_EXPORTED", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "csv-export" });
    const admin = await makeEventAdminUser({ scope: "csv-export", eventId, orgId });
    const participant = await createTestUser({
      scope: "csv-part",
      verified: true,
      profile: true,
    });
    await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "APPROVED",
    });

    await loginAs(page, admin);
    const res = await page.request.get(
      `/api/admin/${orgId}/events/${eventId}/registrations/export`,
    );
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/text\/csv/);
    const csv = await res.text();
    // Verifie quelques colonnes attendues dans l'entete CSV.
    expect(csv).toMatch(/firstName|prenom|prénom/i);
    expect(csv).toMatch(/Awa/);

    const log = await expectLastActivity({
      type: "BADGE_BATCH_EXPORTED",
      userId: admin.id,
      eventId,
    });
    expect((log.details as { format?: string })?.format).toBe("csv");
  });

  test("ADMIN supprime une registration + audit REGISTRATION_DELETED", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "del-reg" });
    const admin = await makeEventAdminUser({ scope: "del-reg", eventId, orgId });
    const participant = await createTestUser({
      scope: "del-reg-part",
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
    const res = await page.request.delete(
      `/api/admin/${orgId}/events/${eventId}/registrations/${reg.id}`,
    );
    expect(res.status()).toBe(204);

    const db = getDb();
    const gone = await db.registration.findUnique({ where: { id: reg.id } });
    expect(gone).toBeNull();

    await expectLastActivity({
      type: "REGISTRATION_DELETED",
      userId: admin.id,
      eventId,
      targetId: reg.id,
    });
  });
});
