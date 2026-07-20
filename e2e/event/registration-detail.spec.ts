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
import { loginAndEnter } from "../helpers/nav";
import { expectLastActivity } from "../helpers/audit";
import { mailpit } from "../helpers/mailpit";

// Page Detail d'inscription — /event/[eventId]/registrations/[regId]
// Rôle : ADMIN (PRINTER/VIEWER refuses). Actions : Approuver, Rejeter/Bloquer
// (modale avec motif), ALL ACCESS, Bloquer e-mail, Bloquer document, Supprimer,
// Voir le badge. Les mails et l'audit accompagnent approve/reject.
test.describe("Event — Detail d'inscription", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function seedReg(
    scope: string,
    status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING",
  ) {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope });
    const participant = await createTestUser({
      scope: `${scope}-part`,
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status,
    });
    const admin = await makeEventAdminUser({ scope, eventId, orgId });
    return { orgId, eventId, categoryId, participant, reg, admin };
  }

  // --- Acces & rendu ------------------------------------------------------

  test("ADMIN voit le detail d'une inscription", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-render");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${reg.id}`));
    await expect(page.getByText(/actions avancées/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /approuver/i })).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("ADMIN approuve via le bouton", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-approve");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${reg.id}`));
    await page.getByRole("button", { name: /approuver/i }).click();

    await expect(page.getByText(/^validé$/i)).toBeVisible();
    expect((await getDb().registration.findUnique({ where: { id: reg.id } }))?.status).toBe(
      "APPROVED",
    );

    await expectLastActivity({
      type: "REGISTRATION_APPROVED",
      userId: admin.id,
      eventId,
      targetId: reg.id,
    });
  });

  test("ADMIN rejette via la modale (motif obligatoire)", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-reject");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${reg.id}`));
    await page.getByRole("button", { name: /rejeter \/ bloquer/i }).click();
    await expect(page.getByRole("heading", { name: /rejeter cette inscription/i })).toBeVisible();

    await page.getByPlaceholder(/motif \(obligatoire\)/i).fill("Document illisible UI");
    await page.getByRole("button", { name: "Rejeter", exact: true }).click();

    await expect(page.getByText(/^rejeté$/i)).toBeVisible();
    await expect(page.getByText(/motif de rejet : document illisible ui/i)).toBeVisible();

    const updated = await getDb().registration.findUnique({ where: { id: reg.id } });
    expect(updated?.status).toBe("REJECTED");
    expect(updated?.rejectionReason).toBe("Document illisible UI");

    await expectLastActivity({
      type: "REGISTRATION_REJECTED",
      userId: admin.id,
      eventId,
      targetId: reg.id,
    });
  });

  test("ADMIN active puis retire ALL ACCESS via le bouton", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-allaccess", "APPROVED");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${reg.id}`));
    await page.getByRole("button", { name: /activer all access/i }).click();

    await expect(page.getByRole("button", { name: /retirer all access/i })).toBeVisible();
    expect(
      (await getDb().registration.findUnique({ where: { id: reg.id } }))?.allAccessGranted,
    ).toBe(true);

    await page.getByRole("button", { name: /retirer all access/i }).click();
    await expect(page.getByRole("button", { name: /activer all access/i })).toBeVisible();
    expect(
      (await getDb().registration.findUnique({ where: { id: reg.id } }))?.allAccessGranted,
    ).toBe(false);
  });

  test("ADMIN bloque l'e-mail via le bouton", async ({ page }) => {
    const { eventId, reg, admin, participant } = await seedReg("det-block-email");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    page.on("dialog", (d) => d.accept());

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${reg.id}`));
    await page.getByRole("button", { name: /bloquer cet e-mail/i }).click();

    await expect(async () => {
      const blocked = await getDb().blockedEmail.findUnique({
        where: { eventId_email: { eventId, email: participant.email } },
      });
      expect(blocked).not.toBeNull();
    }).toPass();
  });

  test("ADMIN bloque le document via le bouton", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-block-doc");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    page.on("dialog", (d) => d.accept());

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${reg.id}`));
    await page.getByRole("button", { name: /bloquer ce document/i }).click();

    await expect(async () => {
      const count = await getDb().blockedDocument.count({ where: { eventId } });
      expect(count).toBeGreaterThan(0);
    }).toPass();
  });

  test("ADMIN supprime l'inscription via le bouton danger", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-delete");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    page.on("dialog", (d) => d.accept());

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${reg.id}`));
    await page.getByRole("button", { name: /^supprimer$/i }).click();

    // Retour a la liste, l'inscription a disparu.
    await page.waitForURL(`**/event/${eventId}/registrations`);
    expect(await getDb().registration.findUnique({ where: { id: reg.id } })).toBeNull();
  });

  test("Le bouton 'Voir le badge' mene au detail du badge", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-badge", "APPROVED");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${reg.id}`));
    await page.getByRole("button", { name: /voir le badge/i }).click();
    await page.waitForURL(`**/event/${eventId}/badges/${reg.id}`);
  });

  // --- Gardes & API -------------------------------------------------------





  // --- Cycle de vie : mails, idempotence, reactivation ---------------------

  test("L'approbation envoie un mail au participant", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-mail-appr");
    await mailpit.clear();
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${reg.id}`));
    await page.getByRole("button", { name: /approuver/i }).click();
    await expect(page.getByText(/^validé$/i)).toBeVisible();

    const saved = await getDb().registration.findUnique({ where: { id: reg.id } });
    await mailpit.expectMail({
      to: saved!.snapshotEmail,
      subjectPattern: /(approuvée|inscription|validée)/i,
    });
  });

  test("Le rejet envoie un mail mentionnant le motif", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-mail-rej");
    await mailpit.clear();
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations/${reg.id}`));
    await page.getByRole("button", { name: /rejeter \/ bloquer/i }).click();
    await page.getByPlaceholder(/motif \(obligatoire\)/i).fill("Piece illisible");
    await page.getByRole("button", { name: "Rejeter", exact: true }).click();
    await expect(page.getByText(/^rejeté$/i)).toBeVisible();

    const saved = await getDb().registration.findUnique({ where: { id: reg.id } });
    await mailpit.expectMail({ to: saved!.snapshotEmail });
  });


  // « Approuver une inscription REJETEE la reactive » n'a pas de surface UI
  // (le bouton Approuver ne s'affiche que pour un statut PENDING) -> couvert en
  // integration : api-event-registrations.test.ts « reactivates a REJECTED... ».

});
