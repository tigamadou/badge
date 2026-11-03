import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestPrintRequest,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";

const LINES = [{ label: "Support badge PVC", quantity: 10, unitPrice: 1500, kind: "PRODUCT" as const }];

const staffMessage = (requestId: string, body: string, internal = false) =>
  getDb().printRequestMessage.create({
    data: { requestId, side: "STAFF", kind: "MESSAGE", body, internal },
  });

// Conversation d'une commande côté organisateur — /event/[eventId]/print/[requestId]
// Rôle : permission `print.request`. Le fil est rafraîchi toutes les 10 s ; les notes internes
// du staff ne sont jamais visibles.
test.describe("Event — Conversation d'une commande d'impression", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("un message du staff arrive par relevé sans recharger la page", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-conv-poll" });
    const admin = await makeEventAdminUser({ scope: "print-conv-poll", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: admin.id, status: "SUBMITTED", lines: LINES });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await page.goto(`/event/${eventId}/print/${request.id}`);
    await expect(page.getByText("Aucun échange pour le moment.")).toBeVisible();

    await staffMessage(request.id, "Bonjour, votre devis arrive.");
    await expect(page.getByTestId("bubble-staff").getByText("Bonjour, votre devis arrive.")).toBeVisible({ timeout: 25_000 });
  });

  test("pastille de non-lus dans la liste et le menu, retirée après lecture", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-conv-unread" });
    const admin = await makeEventAdminUser({ scope: "print-conv-unread", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: admin.id, status: "SUBMITTED", lines: LINES });
    await staffMessage(request.id, "Message non lu");
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await page.goto(`/event/${eventId}/print`);

    await expect(page.getByTestId("unread-badge")).toHaveText("1");
    await expect(page.getByRole("link", { name: /Impression/ }).first().getByLabel("1 en attente")).toBeVisible();

    await page.getByRole("link", { name: request.reference }).click();
    await expect(page.getByText("Message non lu")).toBeVisible();
    await page.getByRole("link", { name: "Impression", exact: false }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print$`));
    await expect(page.getByRole("link", { name: request.reference })).toBeVisible();
    await expect(page.getByTestId("unread-badge")).toHaveCount(0);
    await expect(page.getByLabel("1 en attente")).toHaveCount(0);
  });

  test("une note interne créée en base reste invisible de l'organisateur", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-conv-internal" });
    const admin = await makeEventAdminUser({ scope: "print-conv-internal", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: admin.id, status: "SUBMITTED", lines: LINES });
    await staffMessage(request.id, "Note secrète du staff", true);
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    // Ni dans le non-lu de la liste, ni dans le fil au chargement, ni après un relevé.
    await page.goto(`/event/${eventId}/print`);
    await expect(page.getByTestId("unread-badge")).toHaveCount(0);
    await page.goto(`/event/${eventId}/print/${request.id}`);
    await expect(page.getByText("Aucun échange pour le moment.")).toBeVisible();
    await staffMessage(request.id, "Message public");
    await expect(page.getByText("Message public")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText("Note secrète du staff")).toHaveCount(0);
  });

  test("mobile 375 px : colonnes empilées, saisie accessible sous le fil", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-conv-mobile" });
    const admin = await makeEventAdminUser({ scope: "print-conv-mobile", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: admin.id, status: "SUBMITTED", lines: LINES });
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await page.goto(`/event/${eventId}/print/${request.id}`);

    const composer = page.getByLabel("Votre message");
    await expect(composer).toBeVisible();
    const list = await page.getByTestId("thread-list").boundingBox();
    const input = await composer.boundingBox();
    expect(input!.y).toBeGreaterThanOrEqual(list!.y + list!.height - 1);
    await expect(page.getByLabel("Devis")).toBeVisible();
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noOverflow).toBe(true);
  });
});
