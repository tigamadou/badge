import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestPrintLayout,
  createTestPrintRequest,
  createTestRegistration,
  createTestStaff,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { loginAs } from "../helpers/auth";
import { toast } from "../helpers/feedback";

// Les <Select> de l'application n'associent pas leur libellé au champ (pas de for/id) :
// on cible le <select> qui suit le <label>.
function selectByLabel(page: Page, label: string) {
  return page.locator("label", { hasText: label }).locator("xpath=following-sibling::select").first();
}

// « Planches » ouvre la file « À traiter » ; la génération libre est son troisième onglet.
async function openFreeGeneration(page: Page) {
  await page.getByRole("link", { name: "Planches", exact: true }).click();
  await expect(page).toHaveURL(/\/platform\/print\/sheets\/pending$/);
  await page.getByRole("link", { name: "Génération libre" }).click();
  await expect(page).toHaveURL(/\/platform\/print\/sheets\/free$/);
}

// Page Planches d'impression — /platform/print/sheets (sous-pages À traiter, Générées, Génération libre)
// Rôles : STAFF_PRINTER et STAFF_ADMIN (`print.sheets.read`) ; STAFF_OBSERVER et STAFF_SUPPORT n'ont ni
// l'entrée de menu ni l'accès direct. La génération est traitée par le worker de dev avec le vrai
// moteur de rendu ; le fichier est servi par /api/files avec la même permission.
test.describe("Platform — Planches d'impression", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("L'observateur n'a pas l'entrée Planches et est redirigé en URL directe", async ({ page }) => {
    const observer = await createTestStaff({ scope: "sheets-observer", role: "STAFF_OBSERVER" });
    await loginAndEnter(page, observer, { kind: "platform" });
    await expect(page.getByRole("link", { name: "Planches", exact: true })).toHaveCount(0);
    await page.goto("/platform/print/sheets/pending");
    await expect(page).toHaveURL(/\/platform$/);
  });

  test("STAFF_PRINTER génère les planches d'un évènement et télécharge le PDF", async ({ page }) => {
    test.setTimeout(180_000);
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "sheets-gen" });
    const layout = await createTestPrintLayout({ scope: "sheets-gen" });
    const total = 10;
    for (let i = 0; i < total; i++) {
      const u = await createTestUser({ scope: `sheets-gen-${i}`, verified: true, profile: true });
      await createTestRegistration({ eventId, userId: u.id, categoryId, status: "APPROVED" });
    }
    const support = await createTestStaff({ scope: "sheets-support", role: "STAFF_PRINTER" });

    await loginAndEnter(page, support, { kind: "platform" });
    await openFreeGeneration(page);

    await selectByLabel(page, "Organisation").selectOption(orgId);
    await selectByLabel(page, "Évènement").selectOption(eventId);
    await selectByLabel(page, "Gabarit").selectOption(layout.id);
    await expect(page.getByText(`${total} badges sélectionnés`)).toBeVisible();
    const perSheetText = await page.getByText(/badges? par feuille/).first().innerText();
    const perSheet = Number(perSheetText.match(/(\d+)\s+badges?/)![1]);
    expect(perSheet).toBeGreaterThan(0);
    const expectedPages = Math.ceil(total / perSheet);

    await page.getByRole("button", { name: "Générer" }).click();
    await expect(toast(page, "Génération lancée.")).toBeVisible();

    const row = page.locator("tr", { hasText: "Salon E2E" });
    await expect(row).toContainText("Terminée", { timeout: 120_000 });
    await expect(row).toContainText(layout.name);

    const gen = await getDb().printSheetGeneration.findFirstOrThrow({ where: { eventId } });
    expect(gen.status).toBe("DONE");
    expect(gen.badgeCount).toBe(total);
    expect(gen.sheetCount).toBe(expectedPages);
    expect(gen.fileKey).toBe(`print-sheets/${gen.id}.pdf`);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      row.getByRole("link", { name: "Télécharger" }).click(),
    ]);
    const path = await download.path();
    const pdf = await PDFDocument.load(await readFile(path));
    expect(pdf.getPageCount()).toBe(expectedPages);
    // Planche A3 portrait : 297 x 420 mm = 841,9 x 1190,6 pt.
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(841.9, 0);
    expect(height).toBeCloseTo(1190.6, 0);

    // L'aperçu s'ouvre depuis l'historique.
    await row.getByRole("button", { name: "Aperçu" }).click();
    await expect(page.getByLabel("Planches — Salon E2E")).toBeVisible();
  });

  test("Une commande payée : À traiter, génération, téléchargement, puis regénération avec un autre gabarit", async ({ page }) => {
    test.setTimeout(240_000);
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "sheets-order" });
    const layoutA = await createTestPrintLayout({ scope: "sheets-order-a" });
    const layoutB = await createTestPrintLayout({ scope: "sheets-order-b" });
    const organizer = await createTestUser({ scope: "sheets-order-org", verified: true });
    const registrationIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const u = await createTestUser({ scope: `sheets-order-${i}`, verified: true, profile: true });
      registrationIds.push((await createTestRegistration({ eventId, userId: u.id, categoryId, status: "APPROVED" })).id);
    }
    const request = await createTestPrintRequest({
      eventId,
      orgId,
      createdById: organizer.id,
      status: "PAID",
      registrationIds,
    });
    // Une commande sur place payée n'apparaît jamais dans les sous-pages.
    const onsite = await createTestPrintRequest({ eventId, orgId, createdById: organizer.id, status: "PAID", type: "ONSITE" });
    const support = await createTestStaff({ scope: "sheets-order-support", role: "STAFF_PRINTER" });

    await loginAndEnter(page, support, { kind: "platform" });
    await page.getByRole("link", { name: "Planches", exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/print\/sheets\/pending$/);
    const pendingRow = page.locator("tr", { hasText: request.reference });
    await expect(pendingRow).toContainText("Salon E2E");
    await expect(pendingRow).toContainText("4");
    await expect(page.locator("tr", { hasText: onsite.reference })).toHaveCount(0);

    // Génération : choix du gabarit dans la modale.
    await pendingRow.getByRole("button", { name: "Générer" }).click();
    const dialog = page.getByRole("dialog");
    await selectByLabel(page, "Gabarit").selectOption(layoutA.id);
    await dialog.getByRole("button", { name: "Générer" }).click();
    await expect(toast(page, "Génération lancée.")).toBeVisible();
    // La commande reste dans « À traiter » avec l'état de sa génération, jusqu'à ce que la planche soit prête.
    await expect(pendingRow).toContainText(/En attente…|Génération en cours…/);
    await expect(pendingRow.getByRole("button", { name: "Regénérer" })).toBeDisabled();
    await expect(toast(page, `Planche de ${request.reference} prête`)).toBeVisible({ timeout: 150_000 });
    await expect(pendingRow).toHaveCount(0);

    // Générées : la planche se termine, le PDF est téléchargeable.
    await page.getByRole("link", { name: "Générées" }).click();
    await expect(page).toHaveURL(/\/platform\/print\/sheets\/generated$/);
    const row = page.locator("tr", { hasText: request.reference });
    await expect(row).toContainText("Prête", { timeout: 150_000 });
    await expect(row).toContainText(layoutA.name);
    const key = `print-sheets/orders/${request.id}.pdf`;
    const first = await getDb().printSheetGeneration.findUniqueOrThrow({ where: { printRequestId: request.id } });
    expect(first.fileKey).toBe(key);
    const [download] = await Promise.all([page.waitForEvent("download"), row.getByRole("link", { name: "Télécharger" }).click()]);
    const pdf = await PDFDocument.load(await readFile(await download.path()));
    expect(pdf.getPageCount()).toBeGreaterThan(0);

    // Regénération avec un autre gabarit : même ligne, nouveau gabarit.
    await row.getByRole("button", { name: "Regénérer" }).click();
    await selectByLabel(page, "Gabarit").selectOption(layoutB.id);
    await page.getByRole("dialog").getByRole("button", { name: "Regénérer" }).click();
    await expect(toast(page, "Regénération lancée.")).toBeVisible();
    await expect(row).toContainText(layoutB.name, { timeout: 150_000 });
    await expect(row).toContainText("Prête", { timeout: 150_000 });
    await expect(page.locator("tr", { hasText: request.reference })).toHaveCount(1);
    const rows = await getDb().printSheetGeneration.findMany({ where: { printRequestId: request.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: first.id, status: "DONE", layoutId: layoutB.id, fileKey: key });
  });

  test("Une génération en cours reste dans « À traiter », prête puis passe dans « Générées »", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "sheets-live" });
    const organizer = await createTestUser({ scope: "sheets-live-org", verified: true });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: organizer.id, status: "PAID" });
    const layout = await createTestPrintLayout({ scope: "sheets-live" });
    // Le worker ne prend que les générations PENDING : une génération RUNNING posée en base reste en cours.
    const generation = await getDb().printSheetGeneration.create({
      data: { eventId, printRequestId: request.id, layoutId: layout.id, status: "RUNNING", registrationIds: [] },
    });
    const staff = await createTestStaff({ scope: "sheets-live-staff", role: "STAFF_PRINTER" });
    await loginAndEnter(page, staff, { kind: "platform" });
    await page.getByRole("link", { name: "Planches", exact: true }).click();

    const row = page.locator("tr", { hasText: request.reference });
    await expect(row).toContainText("Génération en cours…");
    await expect(row.getByRole("button", { name: "Regénérer" })).toBeDisabled();

    await getDb().printSheetGeneration.update({
      where: { id: generation.id },
      data: { status: "DONE", fileKey: `print-sheets/orders/${request.id}.pdf`, sheetCount: 1, completedAt: new Date() },
    });
    await expect(toast(page, `Planche de ${request.reference} prête`)).toBeVisible({ timeout: 15_000 });
    await expect(row).toHaveCount(0);
    await page.getByRole("link", { name: "Générées" }).click();
    await expect(page.locator("tr", { hasText: request.reference })).toContainText("Prête");
  });

  test("Une génération en échec reste dans « À traiter » avec son message et un bouton Regénérer actif", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "sheets-failed" });
    const organizer = await createTestUser({ scope: "sheets-failed-org", verified: true });
    const request = await createTestPrintRequest({ eventId, orgId, createdById: organizer.id, status: "PAID" });
    const layout = await createTestPrintLayout({ scope: "sheets-failed" });
    await getDb().printSheetGeneration.create({
      data: {
        eventId, printRequestId: request.id, layoutId: layout.id, status: "FAILED", error: "Rendu impossible", registrationIds: [],
      },
    });
    const staff = await createTestStaff({ scope: "sheets-failed-staff", role: "STAFF_PRINTER" });
    await loginAndEnter(page, staff, { kind: "platform" });
    await page.getByRole("link", { name: "Planches", exact: true }).click();

    const row = page.locator("tr", { hasText: request.reference });
    await expect(row).toContainText("Échec");
    await expect(row).toContainText("Rendu impossible");
    await expect(row.getByRole("button", { name: "Regénérer" })).toBeEnabled();
  });

  test("Sans gabarit sélectionné ni badge, « Générer » reste désactivé", async ({ page }) => {
    const support = await createTestStaff({ scope: "sheets-disabled", role: "STAFF_PRINTER" });
    await loginAndEnter(page, support, { kind: "platform" });
    await openFreeGeneration(page);
    await expect(page.getByRole("button", { name: "Générer" })).toBeDisabled();
  });

  test("Un non-staff reçoit 403 sur un fichier de planches", async ({ page }) => {
    const participant = await createTestUser({ scope: "sheets-403", verified: true, profile: true });
    await loginAs(page, participant);
    const res = await page.goto("/api/files/print-sheets/inexistant.pdf");
    expect(res?.status()).toBe(403);
    await expect(page.locator("body")).toContainText("Accès refusé");
  });
});
