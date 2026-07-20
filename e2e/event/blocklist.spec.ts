import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

// Page Listes de blocage — /event/[eventId]/blocked-emails (onglets e-mails + documents)
// Rôle : ADMIN. /blocked-documents redirige vers cette page (fusion v2-16).
// Les blocages s'appliquent a l'inscription publique (cf. e2e/public/event-register).
test.describe("Event — Listes de blocage", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("ADMIN voit les deux onglets", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "blk-render" });
    const admin = await makeEventAdminUser({ scope: "blk-render", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/blocked-emails`);
    await expect(page.getByRole("tab", { name: /e-mails/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /documents/i })).toBeVisible();
  });

  test("/blocked-documents redirige vers la page unifiee", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "blk-redirect" });
    const admin = await makeEventAdminUser({ scope: "blk-redirect", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/blocked-documents`);
    await page.waitForURL(`**/event/${eventId}/blocked-emails`);
  });

  // --- Actions UI : e-mails -----------------------------------------------

  test("ADMIN bloque puis debloque un e-mail via l'UI", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "blk-email" });
    const admin = await makeEventAdminUser({ scope: "blk-email", eventId, orgId });
    await loginAs(page, admin);
    page.on("dialog", (d) => d.accept());

    const email = `blocked-ui-${Date.now()}@v2-11-e2e.test`;

    await page.goto(`/event/${eventId}/blocked-emails`);
    await page.getByLabel(/e-mail à bloquer/i).fill(email);
    await page.getByRole("button", { name: /^bloquer$/i }).click();
    await expect(page.getByText(email)).toBeVisible();

    expect(
      await getDb().blockedEmail.findUnique({ where: { eventId_email: { eventId, email } } }),
    ).not.toBeNull();

    const addedLog = await expectLastActivity({
      type: "REGISTRATION_UPDATED",
      userId: admin.id,
      eventId,
    });
    expect((addedLog.details as { action?: string })?.action).toBe("blocked-email-added");

    // Retrait (le confirm() est auto-accepte).
    await page.getByRole("button", { name: /retirer/i }).click();
    await expect(page.getByText(email)).toBeHidden();

    expect(
      await getDb().blockedEmail.findUnique({ where: { eventId_email: { eventId, email } } }),
    ).toBeNull();

    const removedLog = await expectLastActivity({
      type: "REGISTRATION_UPDATED",
      userId: admin.id,
      eventId,
    });
    expect((removedLog.details as { action?: string })?.action).toBe("blocked-email-removed");
  });

  // --- Actions UI : documents ---------------------------------------------

  test("ADMIN bloque puis debloque un numero de piece via l'UI", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "blk-doc" });
    const admin = await makeEventAdminUser({ scope: "blk-doc", eventId, orgId });
    await loginAs(page, admin);
    page.on("dialog", (d) => d.accept());

    const docNumber = `UI-DOC-${Date.now()}`;

    await page.goto(`/event/${eventId}/blocked-emails`);
    await page.getByRole("tab", { name: /documents/i }).click();
    await page.getByLabel(/numéro de pièce à bloquer/i).fill(docNumber);
    await page.getByRole("button", { name: /^bloquer$/i }).click();
    await expect(page.getByText(docNumber)).toBeVisible();

    expect(
      await getDb().blockedDocument.findUnique({
        where: { eventId_documentNumber: { eventId, documentNumber: docNumber } },
      }),
    ).not.toBeNull();

    const addedLog = await expectLastActivity({
      type: "REGISTRATION_UPDATED",
      userId: admin.id,
      eventId,
    });
    expect((addedLog.details as { action?: string })?.action).toBe("blocked-document-added");

    await page.getByRole("button", { name: /retirer/i }).click();
    await expect(page.getByText(docNumber)).toBeHidden();

    expect(
      await getDb().blockedDocument.findUnique({
        where: { eventId_documentNumber: { eventId, documentNumber: docNumber } },
      }),
    ).toBeNull();

    const removedLog = await expectLastActivity({
      type: "REGISTRATION_UPDATED",
      userId: admin.id,
      eventId,
    });
    expect((removedLog.details as { action?: string })?.action).toBe("blocked-document-removed");
  });

  // --- Gardes & API -------------------------------------------------------

  test("OPERATOR ne peut pas bloquer un e-mail -> 403", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "blk-operator" });
    const operator = await createTestEventMember({
      scope: "blk-operator-user",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    await loginAs(page, operator);

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/blocked-emails`,
      { data: { email: `nope-${Date.now()}@v2-11-e2e.test` } },
    );
    expect(res.status()).toBe(403);
  });
});
