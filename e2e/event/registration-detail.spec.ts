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
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await expect(page.getByText(/actions avancées/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /approuver/i })).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("ADMIN approuve via le bouton", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-approve");
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
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
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
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
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
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
    await loginAs(page, admin);
    page.on("dialog", (d) => d.accept());

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
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
    await loginAs(page, admin);
    page.on("dialog", (d) => d.accept());

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await page.getByRole("button", { name: /bloquer ce document/i }).click();

    await expect(async () => {
      const count = await getDb().blockedDocument.count({ where: { eventId } });
      expect(count).toBeGreaterThan(0);
    }).toPass();
  });

  test("ADMIN supprime l'inscription via le bouton danger", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-delete");
    await loginAs(page, admin);
    page.on("dialog", (d) => d.accept());

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await page.getByRole("button", { name: /^supprimer$/i }).click();

    // Retour a la liste, l'inscription a disparu.
    await page.waitForURL(`**/event/${eventId}/registrations`);
    expect(await getDb().registration.findUnique({ where: { id: reg.id } })).toBeNull();
  });

  test("Le bouton 'Voir le badge' mene au detail du badge", async ({ page }) => {
    const { eventId, reg, admin } = await seedReg("det-badge", "APPROVED");
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await page.getByRole("button", { name: /voir le badge/i }).click();
    await page.waitForURL(`**/event/${eventId}/badges/${reg.id}`);
  });

  // --- Gardes & API -------------------------------------------------------

  test("VIEWER -> 403 sur le detail", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "det-viewer" });
    const participant = await createTestUser({
      scope: "det-viewer-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "PENDING",
    });
    const viewer = await createTestEventMember({
      scope: "det-viewer-user",
      orgId,
      eventId,
      role: "VIEWER",
    });
    await loginAs(page, viewer);

    const res = await page.request.get(
      `/api/org/${orgId}/events/${eventId}/registrations/${reg.id}`,
    );
    expect(res.status()).toBe(403);
  });

  test("Rejet sans motif -> refuse (400)", async ({ page }) => {
    const { orgId, eventId, reg, admin } = await seedReg("det-reject-nomotif");
    await loginAs(page, admin);

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/registrations/${reg.id}/reject`,
      { data: {} },
    );
    expect(res.status()).toBe(400);
  });
});
