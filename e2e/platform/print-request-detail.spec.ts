import { test, expect, type Page } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestPrintPayment,
  createTestPrintProduct,
  createTestPrintRequest,
  createTestRegistration,
  createTestStaff,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { expectLastActivity } from "../helpers/audit";
import { toast } from "../helpers/feedback";

// Le support de badge doit être un produit BADGE du catalogue : sans lui, l'envoi du devis est refusé
// (BADGE_PRODUCT_REQUIRED).
const lines = (badgeProductId: string) => [
  { label: "Support badge PVC", quantity: 10, unitPrice: 1500, kind: "PRODUCT" as const, productId: badgeProductId },
  { label: "Frais de dossier", quantity: 1, unitPrice: 5000, kind: "SERVICE" as const },
];

// Du menu au détail d'une commande : « Commandes », puis la référence dans la liste.
async function openRequest(page: Page, request: { id: string; reference: string }) {
  await page.getByRole("link", { name: /^Commandes/ }).click();
  await expect(page).toHaveURL(/\/platform\/print\/orders$/);
  await page.getByRole("link", { name: request.reference }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/print/orders/${request.id}$`));
  await expect(page.getByRole("heading", { name: request.reference })).toBeVisible();
}

// Badge de statut : le <span> qui suit le titre de la page.
const statusBadge = (page: Page, reference: string) =>
  page.locator("h1", { hasText: reference }).locator("xpath=following-sibling::span").first();

// Les <Select> de la génération n'associent pas leur libellé au champ : on cible le <select> qui suit le <label>.
const selectByLabel = (page: Page, label: string) =>
  page.locator("label", { hasText: label }).locator("xpath=following-sibling::select").first();

async function seedRequest(
  scope: string,
  status: Parameters<typeof createTestPrintRequest>[0]["status"],
  extra: { registrations?: number } = {},
) {
  const { orgId, eventId, categoryId } = await createTestEvent({ scope });
  const organizer = await createTestUser({ scope: `${scope}-org`, verified: true });
  const registrationIds: string[] = [];
  for (let i = 0; i < (extra.registrations ?? 0); i++) {
    const participant = await createTestUser({ scope: `${scope}-p${i}`, verified: true, profile: true });
    registrationIds.push((await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "APPROVED" })).id);
  }
  const badge = await createTestPrintProduct({ name: "Support badge PVC", kind: "BADGE" });
  const request = await createTestPrintRequest({
    eventId,
    orgId,
    createdById: organizer.id,
    status,
    lines: lines(badge.id),
    registrationIds,
  });
  return { orgId, eventId, request, organizer, registrationIds };
}

// Page Détail d'une commande d'impression (staff) — /platform/print/orders/[requestId]
// Rôles : STAFF_ADMIN modifie le devis, l'envoie, rouvre et marque payée ; STAFF_SUPPORT refuse,
// écrit et fait avancer la production ; STAFF_OBSERVER lit.
test.describe("Platform — Détail d'une commande d'impression", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("STAFF_ADMIN modifie un prix, ajoute des frais et envoie le devis", async ({ page }) => {
    const { eventId, request } = await seedRequest("prd-quote", "SUBMITTED");
    const admin = await createTestStaff({ scope: "prd-quote", role: "STAFF_ADMIN" });
    await loginAndEnter(page, admin, { kind: "platform" });
    await openRequest(page, request);
    await expect(statusBadge(page, request.reference)).toHaveText("Envoyée");

    // Modification d'un prix : enregistrée à la sortie du champ.
    const price = page.getByLabel("Prix unitaire de Frais de dossier");
    await price.fill("6000");
    await price.press("Tab");
    await expect
      .poll(async () => (await getDb().printQuoteLine.findFirstOrThrow({ where: { requestId: request.id, label: "Frais de dossier" } })).unitPrice)
      .toBe(6000);

    // Ajout de frais de livraison.
    await page.getByPlaceholder("Frais de livraison").fill("Frais de livraison");
    await page.getByLabel("Quantité", { exact: true }).fill("1");
    await page.getByLabel("Prix unitaire", { exact: true }).fill("2500");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByLabel("Intitulé de la ligne Frais de livraison")).toBeVisible();
    const added = await getDb().printQuoteLine.findFirstOrThrow({ where: { requestId: request.id, label: "Frais de livraison" } });
    expect(added.unitPrice).toBe(2500);
    expect(added.addedBy).toBe("STAFF");

    // Les deux modifications consécutives du même auteur forment une seule entrée du fil.
    await expect(page.getByText("2 lignes modifiées")).toHaveCount(1);

    // Envoi du devis.
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await expect(toast(page, "Devis envoyé.")).toBeVisible();
    await expect(statusBadge(page, request.reference)).toHaveText("Devis envoyé");
    await expect(page.getByText(/Devis v1 envoyé/)).toBeVisible();
    const quoted = await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(quoted.status).toBe("QUOTED");
    expect(quoted.quoteVersion).toBe(1);
    await expectLastActivity({ type: "PRINT_REQUEST_QUOTED", eventId, userId: admin.id, targetId: request.id });
  });

  test("Le refus exige un motif : bouton désactivé tant qu'il est vide, puis refus transmis", async ({ page }) => {
    const { eventId, request } = await seedRequest("prd-reject", "SUBMITTED");
    const support = await createTestStaff({ scope: "prd-reject", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });
    await openRequest(page, request);

    await page.getByRole("button", { name: "Refuser", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Refuser la commande" });
    await expect(dialog).toBeVisible();

    // Échec attendu : motif vide ou blanc, la confirmation reste impossible et rien ne change.
    const confirm = dialog.getByRole("button", { name: "Refuser", exact: true });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill("   ");
    await expect(confirm).toBeDisabled();
    expect((await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("SUBMITTED");

    // Succès : avec un motif, la commande est refusée et le motif apparaît dans le fil.
    await dialog.getByRole("textbox").fill("Maquette illisible");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(toast(page, "Commande refusée.")).toBeVisible();
    await expect(statusBadge(page, request.reference)).toHaveText("Refusée");
    await expect(page.getByText("Commande refusée : Maquette illisible")).toBeVisible();
    expect((await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("REJECTED");
    await expectLastActivity({ type: "PRINT_REQUEST_REJECTED", eventId, userId: support.id, targetId: request.id });
  });

  test("STAFF_ADMIN marque payée une commande acceptée avec un motif de paiement hors ligne", async ({ page }) => {
    const { eventId, request } = await seedRequest("prd-paid", "ACCEPTED");
    const admin = await createTestStaff({ scope: "prd-paid", role: "STAFF_ADMIN" });
    await loginAndEnter(page, admin, { kind: "platform" });
    await openRequest(page, request);
    await expect(statusBadge(page, request.reference)).toHaveText("Devis accepté");

    await page.getByRole("button", { name: "Marquer payée", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Marquer la commande payée" });
    const confirm = dialog.getByRole("button", { name: "Marquer payée", exact: true });
    // Motif de moins de 3 caractères : confirmation impossible.
    await dialog.getByRole("textbox").fill("ab");
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill("virement du 30/10");
    await confirm.click();

    // Succès : statut « Payée », entrée du fil « (hors ligne : …) », effet en base et audit.
    await expect(toast(page, "Commande marquée payée.")).toBeVisible();
    await expect(statusBadge(page, request.reference)).toHaveText("Payée");
    await expect(page.getByText(/Paiement reçu : .* \(hors ligne : virement du 30\/10\)/)).toBeVisible();
    const paid = await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(paid.status).toBe("PAID");
    expect(paid.paidAt).not.toBeNull();
    await expectLastActivity({ type: "PRINT_REQUEST_MARKED_PAID", eventId, userId: admin.id, targetId: request.id });
  });

  test("STAFF_SUPPORT ne voit ni l'éditeur de lignes ni « Marquer payée »", async ({ page }) => {
    const submitted = await seedRequest("prd-support-sub", "SUBMITTED");
    const accepted = await seedRequest("prd-support-acc", "ACCEPTED");
    const support = await createTestStaff({ scope: "prd-support", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });

    // Commande envoyée : devis en lecture seule, ni ajout de ligne ni envoi du devis.
    await openRequest(page, submitted.request);
    await expect(page.getByText("Lecture seule dans cet état.")).toBeVisible();
    await expect(page.getByText("Ajouter une ligne")).toHaveCount(0);
    await expect(page.getByLabel("Prix unitaire de Frais de dossier")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Envoyer le devis" })).toHaveCount(0);
    // Le support peut en revanche écrire à l'organisateur et refuser.
    await expect(page.getByLabel("Votre message")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refuser", exact: true })).toBeVisible();

    // Commande acceptée : ni « Marquer payée » ni « Rouvrir le devis ».
    await page.getByRole("link", { name: "Commandes" }).first().click();
    await expect(page).toHaveURL(/\/platform\/print\/orders$/);
    await page.getByRole("link", { name: accepted.request.reference }).click();
    await expect(page).toHaveURL(new RegExp(`/platform/print/orders/${accepted.request.id}$`));
    await expect(statusBadge(page, accepted.request.reference)).toHaveText("Devis accepté");
    await expect(page.getByRole("button", { name: "Marquer payée" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rouvrir le devis" })).toHaveCount(0);
  });

  test("« Générer les planches » ouvre la génération pré-remplie par la commande payée", async ({ page }) => {
    const { orgId, eventId, request } = await seedRequest("prd-sheets", "PAID", { registrations: 2 });
    const support = await createTestStaff({ scope: "prd-sheets", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });
    await openRequest(page, request);

    await page.getByRole("link", { name: "Générer les planches" }).click();
    await expect(page).toHaveURL(new RegExp(`/platform/print/sheets\\?printRequestId=${request.id}$`));
    await expect(page.getByText(`Planches de la commande ${request.reference}`)).toBeVisible();
    // Organisation et évènement sont ceux de la commande et ne se changent plus.
    await expect(selectByLabel(page, "Organisation")).toHaveValue(orgId);
    await expect(selectByLabel(page, "Organisation")).toBeDisabled();
    await expect(selectByLabel(page, "Évènement")).toHaveValue(eventId);
    await expect(selectByLabel(page, "Évènement")).toBeDisabled();
    await expect(page.getByText("2 badges de la commande, dans l'ordre de la commande.")).toBeVisible();
  });

  test("Le lien « Générer les planches » n'existe pas avant le paiement", async ({ page }) => {
    const { request } = await seedRequest("prd-no-sheets", "ACCEPTED", { registrations: 1 });
    const admin = await createTestStaff({ scope: "prd-no-sheets", role: "STAFF_ADMIN" });
    await loginAndEnter(page, admin, { kind: "platform" });
    await openRequest(page, request);

    await expect(page.getByRole("link", { name: "Générer les planches" })).toHaveCount(0);
  });

  test("La carte « Paiements » liste le paiement d'impression de la commande", async ({ page }) => {
    const { orgId, request, organizer } = await seedRequest("prd-payments", "PAID");
    await createTestPrintPayment({
      orgId,
      requestId: request.id,
      userId: organizer.id,
      amount: 20000,
      status: "APPROVED",
      settle: true,
    });
    const support = await createTestStaff({ scope: "prd-payments", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });
    await openRequest(page, request);

    await expect(page.getByText("Paiements", { exact: true })).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(`Impression ${request.reference}`) });
    await expect(row).toContainText("20 000 FCFA");
    await expect(row).toContainText("Payé");
  });

  test("« Marquer payée » est refusé tant qu'un paiement FedaPay est en cours", async ({ page }) => {
    const { orgId, request, organizer } = await seedRequest("prd-paid-pending", "ACCEPTED");
    await createTestPrintPayment({ orgId, requestId: request.id, userId: organizer.id, amount: 20000, status: "PENDING" });
    const admin = await createTestStaff({ scope: "prd-paid-pending", role: "STAFF_ADMIN" });
    await loginAndEnter(page, admin, { kind: "platform" });
    await openRequest(page, request);

    await page.getByRole("button", { name: "Marquer payée", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Marquer la commande payée" });
    await dialog.getByRole("textbox").fill("virement du 30/10");
    await dialog.getByRole("button", { name: "Marquer payée", exact: true }).click();

    // Échec attendu : message de paiement en cours, la commande reste acceptée.
    await expect(toast(page, "Un paiement FedaPay est en cours sur cette commande.")).toBeVisible();
    await expect(statusBadge(page, request.reference)).toHaveText("Devis accepté");
    const unchanged = await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(unchanged.status).toBe("ACCEPTED");
    expect(unchanged.paidAt).toBeNull();
  });
});
