import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestPrintPayment,
  createTestPrintRequest,
  disconnectDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";

const LINES = [{ label: "Support badge PVC", quantity: 100, unitPrice: 1500, kind: "PRODUCT" as const }];

// Page de retour FedaPay d'un devis d'impression — /event/[eventId]/print/[requestId]/return?id=<transaction>
// Rôle : permission `print.request`. FedaPay n'est pas joignable en e2e : seul un paiement déjà
// `APPROVED` en base est testé (aucune relecture FedaPay), plus l'identifiant inconnu.
test.describe("Event — Retour de paiement d'un devis d'impression", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("Un paiement approuvé qui a soldé la commande affiche « Paiement confirmé »", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-return-paid" });
    const owner = await makeEventAdminUser({ scope: "print-return-paid", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: owner.id, status: "PAID", lines: LINES });
    const payment = await createTestPrintPayment({
      orgId,
      requestId: request.id,
      userId: owner.id,
      amount: 150000,
      status: "APPROVED",
      settle: true,
    });
    await loginAndEnter(page, owner, { kind: "event", id: eventId });
    await page.goto(`/event/${eventId}/print/${request.id}/return?id=${payment.fedapayTransactionId}`);

    await expect(page.getByText(`Paiement confirmé. La commande ${request.reference} est payée`)).toBeVisible();
    // Le lien de retour ramène au détail de la commande.
    await page.getByRole("link", { name: "Retour à la commande" }).click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print/${request.id}$`));
    await expect(page.getByRole("heading", { name: request.reference })).toBeVisible();
  });

  test("Un identifiant de transaction inconnu affiche « Paiement introuvable. »", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-return-unknown" });
    const owner = await makeEventAdminUser({ scope: "print-return-unknown", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: owner.id, status: "ACCEPTED", lines: LINES });
    await loginAndEnter(page, owner, { kind: "event", id: eventId });
    await page.goto(`/event/${eventId}/print/${request.id}/return?id=987654321`);

    await expect(page.getByText("Paiement introuvable.")).toBeVisible();
    await expect(page.getByText(/Paiement confirmé/)).toHaveCount(0);
  });

  test("Sans identifiant dans l'URL, la page affiche « Paiement introuvable. »", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-return-noid" });
    const owner = await makeEventAdminUser({ scope: "print-return-noid", eventId, orgId });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: owner.id, status: "ACCEPTED", lines: LINES });
    await loginAndEnter(page, owner, { kind: "event", id: eventId });
    await page.goto(`/event/${eventId}/print/${request.id}/return`);

    await expect(page.getByText("Paiement introuvable.")).toBeVisible();
  });
});
