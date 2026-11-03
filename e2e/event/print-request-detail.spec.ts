import { test, expect, type Page } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestPrintPayment,
  createTestPrintRequest,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { expectLastActivity } from "../helpers/audit";
import { toast } from "../helpers/feedback";
import { ensureFixtures } from "../fixtures";

const LINES = [
  { label: "Support badge PVC", quantity: 10, unitPrice: 1500, kind: "PRODUCT" as const },
  { label: "Frais de dossier", quantity: 1, unitPrice: 5000, kind: "SERVICE" as const },
];

// Devis de 150 000 FCFA : une ligne produit de 100 x 1 500.
const PAY_LINES = [{ label: "Support badge PVC", quantity: 100, unitPrice: 1500, kind: "PRODUCT" as const }];

// Du menu au détail d'une commande : « Impression », puis la référence dans la liste.
async function openRequest(page: Page, eventId: string, request: { id: string; reference: string }) {
  await page.getByRole("link", { name: "Impression", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print$`));
  await page.getByRole("link", { name: request.reference }).click();
  await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print/${request.id}$`));
  await expect(page.getByRole("heading", { name: request.reference })).toBeVisible();
}

// Badge de statut : dans le résumé de la commande (colonne de gauche).
const statusBadge = (page: Page, _reference: string) => page.getByTestId("order-status");

// Page Détail d'une commande d'impression — /event/[eventId]/print/[requestId]
// Rôle : permission `print.request`. Seul le propriétaire de l'organisation (OWNER) accepte un devis.
// Actions : échanger avec l'équipe (message + pièce jointe), accepter le devis, le payer (bouton « Payer », FedaPay
// n'est pas appelé en e2e), annuler la commande.
test.describe("Event — Détail d'une commande d'impression", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN envoie un message avec pièce jointe, visible dans le fil", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-detail-msg" });
    const admin = await makeEventAdminUser({ scope: "print-detail-msg", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: admin.id, status: "SUBMITTED", lines: LINES });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await openRequest(page, eventId, request);

    await expect(page.getByText("Aucun échange pour le moment.")).toBeVisible();
    await page.getByLabel("Votre message").fill("Voici notre maquette de badge.");
    await page.locator('input[type="file"]').setInputFiles(ensureFixtures().pdf);
    await expect(page.getByText("awa-cni.pdf")).toBeVisible();
    await page.getByRole("button", { name: "Envoyer", exact: true }).click();

    // Succès : le message et sa pièce jointe apparaissent dans le fil, le champ est vidé.
    await expect(page.getByText("Voici notre maquette de badge.")).toBeVisible();
    await expect(page.locator('a[href^="/api/files/print-requests/"]')).toBeVisible();
    await expect(page.getByLabel("Votre message")).toHaveValue("");
    const message = await getDb().printRequestMessage.findFirstOrThrow({
      where: { requestId: request.id, kind: "MESSAGE" },
    });
    expect(message.side).toBe("ORGANIZER");
    expect(message.authorId).toBe(admin.id);
    expect(message.attachmentKey).toMatch(new RegExp(`^print-requests/${eventId}/`));
  });

  test("« Envoyer » reste désactivé tant que le message est vide", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-detail-empty" });
    const admin = await makeEventAdminUser({ scope: "print-detail-empty", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: admin.id, status: "SUBMITTED", lines: LINES });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await openRequest(page, eventId, request);

    await expect(page.getByRole("button", { name: "Envoyer", exact: true })).toBeDisabled();
    expect(await getDb().printRequestMessage.count({ where: { requestId: request.id } })).toBe(0);
  });

  test("MANAGER lit que seul le propriétaire peut accepter le devis v2", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-detail-manager" });
    const owner = await makeEventAdminUser({ scope: "print-detail-manager-owner", eventId, orgId });
    const request = await createTestPrintRequest({
      eventId,
      orgId,
      createdById: owner.id,
      status: "QUOTED",
      quoteVersion: 2,
      lines: LINES,
    });
    const manager = await createTestUser({ scope: "print-detail-manager", verified: true });
    await getDb().orgMembership.create({ data: { userId: manager.id, orgId, role: "MANAGER" } });
    await getDb().eventMembership.create({ data: { userId: manager.id, eventId, role: "ADMIN" } });
    await loginAndEnter(page, manager, { kind: "event", id: eventId });
    await openRequest(page, eventId, request);

    await expect(page.getByText("Devis v2")).toBeVisible();
    await expect(page.getByText("Seul le propriétaire de l'organisation peut accepter ce devis.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Accepter le devis/ })).toHaveCount(0);
    expect((await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("QUOTED");
  });

  test("OWNER accepte le devis v2 et voit « Devis accepté »", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-detail-accept" });
    const owner = await makeEventAdminUser({ scope: "print-detail-accept", eventId, orgId });
    const request = await createTestPrintRequest({
      eventId,
      orgId,
      createdById: owner.id,
      status: "QUOTED",
      quoteVersion: 2,
      lines: LINES,
    });
    await loginAndEnter(page, owner, { kind: "event", id: eventId });
    await openRequest(page, eventId, request);

    await expect(statusBadge(page, request.reference)).toHaveText("Devis envoyé");
    await page.getByRole("button", { name: "Accepter le devis v2" }).click();

    // Succès : toast, statut mis à jour, bouton retiré ; version et total acceptés en base.
    await expect(toast(page, "Devis accepté.")).toBeVisible();
    await expect(statusBadge(page, request.reference)).toHaveText("Devis accepté");
    await expect(page.getByRole("button", { name: /Accepter le devis/ })).toHaveCount(0);
    const accepted = await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.acceptedVersion).toBe(2);
    expect(accepted.acceptedById).toBe(owner.id);
    await expectLastActivity({ type: "PRINT_REQUEST_ACCEPTED", eventId, userId: owner.id, targetId: request.id });
  });

  test("ADMIN annule une commande envoyée après confirmation", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-detail-cancel" });
    const admin = await makeEventAdminUser({ scope: "print-detail-cancel", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: admin.id, status: "SUBMITTED", lines: LINES });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await openRequest(page, eventId, request);

    // « Garder la commande » referme la confirmation sans rien changer.
    await page.getByRole("button", { name: "Annuler la commande" }).click();
    const dialog = page.getByRole("dialog", { name: "Annuler la commande" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Garder la commande" }).click();
    await expect(dialog).toHaveCount(0);
    expect((await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("SUBMITTED");

    await page.getByRole("button", { name: "Annuler la commande" }).click();
    await dialog.getByRole("button", { name: "Annuler la commande" }).click();

    // Succès : toast, statut « Annulée », plus d'action, effet en base et trace d'audit.
    await expect(toast(page, "Commande annulée.")).toBeVisible();
    await expect(statusBadge(page, request.reference)).toHaveText("Annulée");
    await expect(page.getByRole("button", { name: "Annuler la commande" })).toHaveCount(0);
    expect((await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("CANCELLED");
    await expectLastActivity({ type: "PRINT_REQUEST_CANCELLED", eventId, userId: admin.id, targetId: request.id });
  });

  test("OWNER voit « Payer 150 000 FCFA » sur un devis accepté", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-detail-pay" });
    const owner = await makeEventAdminUser({ scope: "print-detail-pay", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: owner.id, status: "ACCEPTED", lines: PAY_LINES });
    await loginAndEnter(page, owner, { kind: "event", id: eventId });
    await openRequest(page, eventId, request);

    await expect(statusBadge(page, request.reference)).toHaveText("Devis accepté");
    await expect(page.getByRole("button", { name: "Payer 150 000 FCFA" })).toBeVisible();
    await expect(page.getByText("Un paiement est en cours. Vous pouvez le reprendre.")).toHaveCount(0);
  });

  test("OWNER peut reprendre un paiement en cours : la mention s'affiche avec le bouton", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-detail-pay-pending" });
    const owner = await makeEventAdminUser({ scope: "print-detail-pay-pending", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: owner.id, status: "ACCEPTED", lines: PAY_LINES });
    await createTestPrintPayment({ orgId, requestId: request.id, userId: owner.id, amount: 150000, status: "PENDING" });
    await loginAndEnter(page, owner, { kind: "event", id: eventId });
    await openRequest(page, eventId, request);

    await expect(page.getByText("Un paiement est en cours. Vous pouvez le reprendre.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Payer 150 000 FCFA" })).toBeVisible();
  });

  test("MANAGER lit que seul le propriétaire peut payer le devis, sans bouton « Payer »", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-detail-pay-manager" });
    const owner = await makeEventAdminUser({ scope: "print-detail-pay-manager-owner", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: owner.id, status: "ACCEPTED", lines: PAY_LINES });
    const manager = await createTestUser({ scope: "print-detail-pay-manager", verified: true });
    await getDb().orgMembership.create({ data: { userId: manager.id, orgId, role: "MANAGER" } });
    await getDb().eventMembership.create({ data: { userId: manager.id, eventId, role: "ADMIN" } });
    await loginAndEnter(page, manager, { kind: "event", id: eventId });
    await openRequest(page, eventId, request);

    await expect(page.getByText("Seul le propriétaire de l'organisation peut payer ce devis.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Payer/ })).toHaveCount(0);
    expect((await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("ACCEPTED");
  });
});
