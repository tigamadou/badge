import { test, expect, type Page } from "@playwright/test";
import {
  cleanupE2ETestData,
  createManyTestRegistrations,
  createTestEvent,
  createTestPrintProduct,
  createTestPrintRequest,
  createTestRegistration,
  createTestStaff,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { toast } from "../helpers/feedback";

// Lien factice : seul le segment /verify/<id> compte pour le poste (c'est le contenu d'un QR d'accueil).
const qrOf = (registrationId: string) => `https://badge.example/verify/${registrationId}`;

// Commande sur place payée : 10 badges commandés (ligne produit BADGE) et marge de la commande.
// Plafond = 10 + 10 % = 11. `printed` inscriptions approuvées sont déjà imprimées (journal + badge imprimé),
// puis une dernière inscription approuvée reste à imprimer (`nextId`). Identifiants triés par nom.
async function seedOnsiteRequest(
  scope: string,
  opts: { printed?: number; margin?: number } = {},
) {
  const printed = opts.printed ?? 0;
  const { orgId, eventId, categoryId } = await createTestEvent({ scope });
  const organizer = await createTestUser({ scope: `${scope}-org`, verified: true });
  const product = await createTestPrintProduct({ name: `Support PVC ${scope}`, kind: "BADGE" });
  await createManyTestRegistrations({ scope, eventId, categoryId, count: printed + 1 });
  const registrations = await getDb().registration.findMany({
    where: { eventId },
    orderBy: { snapshotLastName: "asc" },
    select: { id: true },
  });
  const ids = registrations.map((r) => r.id);
  const request = await createTestPrintRequest({
    eventId,
    orgId,
    createdById: organizer.id,
    type: "ONSITE",
    status: "PAID",
    marginPercent: opts.margin ?? 10,
    lines: [{ label: "Support badge PVC", quantity: 10, unitPrice: 1500, kind: "PRODUCT", productId: product.id }],
    prints: ids.slice(0, printed).map((registrationId) => ({ registrationId })),
  });
  return { orgId, eventId, categoryId, request, printedIds: ids.slice(0, printed), nextId: ids[printed] };
}

// Du menu à la commande : « Commandes », puis la référence dans la liste.
async function openRequest(page: Page, request: { id: string; reference: string }) {
  await page.getByRole("link", { name: /^Commandes/ }).click();
  await expect(page).toHaveURL(/\/platform\/print\/orders$/);
  await page.getByRole("link", { name: request.reference }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/print/orders/${request.id}$`));
  await expect(page.getByRole("heading", { name: request.reference })).toBeVisible();
}

// De la commande au poste d'impression, caméra coupée (elle n'est pas disponible en e2e).
async function openStation(page: Page, request: { id: string; reference: string }) {
  await page.getByRole("link", { name: "Ouvrir le poste d'impression" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/print/orders/${request.id}/onsite$`));
  await expect(page.getByRole("heading", { name: `Poste d'impression · ${request.reference}` })).toBeVisible();
  await page.getByRole("button", { name: "Désactiver la caméra" }).click();
  await expect(page.getByText("Caméra désactivée")).toBeVisible();
}

// Saisie du contenu d'un QR (ou d'un nom) dans le champ de recherche du poste.
async function submitQuery(page: Page, text: string) {
  await page.getByLabel("Nom, email, ID ou contenu du QR").fill(text);
  await page.getByRole("button", { name: "Rechercher" }).click();
}

const counter = (page: Page) => page.getByTestId("onsite-counter");

// Page Poste d'impression sur place — /platform/print/orders/[requestId]/onsite, ouvert depuis le bloc
// « impression sur place » de la commande. La caméra n'est pas automatisable : le contenu du QR d'accueil
// est saisi dans le champ de recherche (toute saisie qui contient /verify/ est lue comme un QR).
// Rôles : STAFF_SUPPORT imprime ; STAFF_ADMIN règle en plus la marge (motif obligatoire).
test.describe("Platform — Poste d'impression sur place", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("STAFF_SUPPORT ouvre le poste, saisit un QR d'accueil et imprime : compteur 1 / 10 et journal", async ({ page }) => {
    const { eventId, categoryId, request } = await seedOnsiteRequest("onsite-print");
    const participant = await createTestUser({ scope: "onsite-print-part", verified: true, profile: true });
    const reg = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "APPROVED" });
    const support = await createTestStaff({ scope: "onsite-print", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });
    await openRequest(page, request);

    // Bloc de la commande : compteur à zéro, plafond 11, pas de réglage de marge pour STAFF_SUPPORT.
    await expect(counter(page)).toContainText("0 / 10 badges imprimés");
    await expect(counter(page)).toContainText("Plafond 11 · marge 10 %");
    await expect(page.getByLabel("Marge (%)")).toHaveCount(0);

    await openStation(page, request);
    await expect(counter(page)).toContainText("0 / 10 badges imprimés");
    await expect(page.getByText("Scannez le QR d'accueil d'un participant ou recherchez-le.")).toBeVisible();

    // Le contenu du QR d'accueil ouvre la fiche du participant.
    await submitQuery(page, qrOf(reg.id));
    await expect(page.getByText("Awa Diallo", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimer", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Réimprimer", exact: true })).toHaveCount(0);

    // Impression : l'onglet du PDF s'ouvre depuis le clic.
    const popup = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Imprimer", exact: true }).click();
    await popup;
    await expect(toast(page, "Badge envoyé à l'impression")).toBeVisible();
    await expect(counter(page)).toContainText("1 / 10 badges imprimés");
    await expect(page.getByText(/Déjà imprimé le/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Réimprimer", exact: true })).toBeVisible();

    // Effet persistant : une impression au journal, l'inscription passe « badge imprimé ».
    const prints = await getDb().printRequestPrint.findMany({ where: { requestId: request.id } });
    expect(prints).toHaveLength(1);
    expect(prints[0]).toMatchObject({ registrationId: reg.id, printedById: support.id, reprint: false });
    const stored = await getDb().registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(stored.badgePrinted).toBe(true);
    expect(stored.badgePrintedAt).not.toBeNull();
  });

  test("Réimprimer un badge déjà imprimé est proposé, journalisé et n'est pas compté", async ({ page }) => {
    const { request, printedIds } = await seedOnsiteRequest("onsite-reprint", { printed: 1 });
    const support = await createTestStaff({ scope: "onsite-reprint", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });
    await openRequest(page, request);
    await openStation(page, request);
    await expect(counter(page)).toContainText("1 / 10 badges imprimés");

    await submitQuery(page, qrOf(printedIds[0]));
    await expect(page.getByText(/Déjà imprimé le/)).toBeVisible();
    // Un badge déjà imprimé ne propose plus « Imprimer » : seulement « Réimprimer ».
    await expect(page.getByRole("button", { name: "Imprimer", exact: true })).toHaveCount(0);

    const popup = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Réimprimer", exact: true }).click();
    await popup;
    await expect(toast(page, "Badge envoyé à l'impression")).toBeVisible();

    // Le compteur ne bouge pas ; le journal garde la réimpression à part.
    await expect(counter(page)).toContainText("1 / 10 badges imprimés");
    const prints = await getDb().printRequestPrint.findMany({ where: { requestId: request.id }, orderBy: { printedAt: "asc" } });
    expect(prints.map((p) => p.reprint)).toEqual([false, true]);
  });

  test("Le QR d'un autre évènement est refusé et rien n'est imprimé", async ({ page }) => {
    const { request } = await seedOnsiteRequest("onsite-foreign");
    const other = await createTestEvent({ scope: "onsite-foreign-other" });
    const stranger = await createTestUser({ scope: "onsite-foreign-part", verified: true, profile: true });
    const foreign = await createTestRegistration({
      eventId: other.eventId,
      userId: stranger.id,
      categoryId: other.categoryId,
      status: "APPROVED",
    });
    const support = await createTestStaff({ scope: "onsite-foreign", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });
    await openRequest(page, request);
    await openStation(page, request);

    await submitQuery(page, qrOf(foreign.id));
    await expect(page.getByText("Ce QR ne correspond pas à cet évènement.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimer", exact: true })).toHaveCount(0);
    await expect(counter(page)).toContainText("0 / 10 badges imprimés");
    expect(await getDb().printRequestPrint.count({ where: { requestId: request.id } })).toBe(0);
  });

  test("Une inscription en attente est refusée avec son statut : le poste n'approuve personne", async ({ page }) => {
    const { eventId, categoryId, request } = await seedOnsiteRequest("onsite-pending");
    const participant = await createTestUser({ scope: "onsite-pending-part", verified: true, profile: true });
    const pending = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "PENDING" });
    const support = await createTestStaff({ scope: "onsite-pending", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });
    await openRequest(page, request);
    await openStation(page, request);

    await submitQuery(page, qrOf(pending.id));
    await expect(page.getByText("Inscription non approuvée (en attente) : le poste n'approuve personne.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimer", exact: true })).toHaveCount(0);
    expect(await getDb().printRequestPrint.count({ where: { requestId: request.id } })).toBe(0);
    expect((await getDb().registration.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("PENDING");
  });

  test("La recherche par nom propose les participants de l'évènement", async ({ page }) => {
    const { request } = await seedOnsiteRequest("onsite-search");
    const support = await createTestStaff({ scope: "onsite-search", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });
    await openRequest(page, request);
    await openStation(page, request);

    await submitQuery(page, "Nom0000");
    await page.getByRole("button", { name: /Awa Nom0000/ }).click();
    await expect(page.getByRole("button", { name: "Imprimer", exact: true })).toBeEnabled();

    // Aucun résultat : message vide, sans fiche.
    await submitQuery(page, "zzz-introuvable");
    await expect(page.getByText("Aucun résultat.")).toBeVisible();
  });

  test("Plafond atteint (11) : « Imprimer » est désactivé, la réimpression reste possible", async ({ page }) => {
    const { request, printedIds, nextId } = await seedOnsiteRequest("onsite-cap", { printed: 11 });
    const support = await createTestStaff({ scope: "onsite-cap", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });
    await openRequest(page, request);
    await openStation(page, request);

    await expect(counter(page)).toContainText("11 / 10 badges imprimés");
    await expect(counter(page)).toContainText("Plafond atteint (11)");

    // Une première impression de plus : bouton désactivé et explication.
    await submitQuery(page, qrOf(nextId));
    await expect(page.getByRole("button", { name: "Imprimer", exact: true })).toBeDisabled();
    await expect(page.getByText("Plafond atteint : seules les réimpressions restent possibles.")).toBeVisible();

    // Une réimpression passe encore.
    await submitQuery(page, qrOf(printedIds[0]));
    await expect(page.getByRole("button", { name: "Réimprimer", exact: true })).toBeEnabled();
    expect(await getDb().printRequestPrint.count({ where: { requestId: request.id, reprint: false } })).toBe(11);
  });

  test("STAFF_ADMIN relève la marge avec un motif : l'impression reprend", async ({ page }) => {
    const { request, nextId } = await seedOnsiteRequest("onsite-margin", { printed: 11 });
    const admin = await createTestStaff({ scope: "onsite-margin", role: "STAFF_ADMIN" });
    await loginAndEnter(page, admin, { kind: "platform" });
    await openRequest(page, request);
    await expect(counter(page)).toContainText("Plafond atteint (11)");

    // Le motif est obligatoire : sans lui, « Enregistrer » reste désactivé.
    const form = page.locator("form", { has: page.getByLabel("Marge (%)") });
    await form.getByLabel("Marge (%)").fill("20");
    await expect(form.getByRole("button", { name: "Enregistrer" })).toBeDisabled();

    // Échec attendu : une marge qui ramène le plafond sous le nombre déjà imprimé est refusée.
    await form.getByLabel("Marge (%)").fill("0");
    await form.getByLabel("Motif").fill("Test de baisse");
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(toast(page, "La marge ne peut pas être inférieure au nombre de badges déjà imprimés.")).toBeVisible();
    expect((await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } })).marginPercent).toBe(10);

    // Succès : marge 20 %, plafond 12, motif au fil de la commande.
    await form.getByLabel("Marge (%)").fill("20");
    await form.getByLabel("Motif").fill("Affluence imprévue");
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(toast(page, "Marge mise à jour")).toBeVisible();
    await expect(counter(page)).toContainText("Plafond 12 · marge 20 %");
    expect((await getDb().printRequest.findUniqueOrThrow({ where: { id: request.id } })).marginPercent).toBe(20);
    const event = await getDb().printRequestMessage.findFirstOrThrow({
      where: { requestId: request.id, eventType: "ONSITE_MARGIN_CHANGED" },
    });
    expect(JSON.stringify(event.details)).toContain("Affluence imprévue");

    // L'impression reprend : la 12e première impression passe.
    await openStation(page, request);
    await submitQuery(page, qrOf(nextId));
    await expect(page.getByRole("button", { name: "Imprimer", exact: true })).toBeEnabled();
    const popup = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Imprimer", exact: true }).click();
    await popup;
    await expect(toast(page, "Badge envoyé à l'impression")).toBeVisible();
    await expect(counter(page)).toContainText("12 / 10 badges imprimés");
    await expect(counter(page)).toContainText("Plafond atteint (12)");
    expect(await getDb().printRequestPrint.count({ where: { requestId: request.id, reprint: false } })).toBe(12);
  });

  test("Une commande non payée n'offre pas le poste d'impression", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "onsite-unpaid" });
    const organizer = await createTestUser({ scope: "onsite-unpaid-org", verified: true });
    const request = await createTestPrintRequest({
      eventId,
      orgId,
      createdById: organizer.id,
      type: "ONSITE",
      status: "QUOTED",
      lines: [{ label: "Support badge PVC", quantity: 10, unitPrice: 1500, kind: "PRODUCT" }],
    });
    const support = await createTestStaff({ scope: "onsite-unpaid", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });
    await openRequest(page, request);

    await expect(page.getByRole("link", { name: "Ouvrir le poste d'impression" })).toHaveCount(0);
    await expect(page.getByTestId("onsite-counter")).toHaveCount(0);

    // Accès direct au poste : retour à la commande.
    await page.goto(`/platform/print/orders/${request.id}/onsite`);
    await expect(page).toHaveURL(new RegExp(`/platform/print/orders/${request.id}$`));
  });
});
