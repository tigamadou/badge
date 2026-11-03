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
  await page.getByRole("link", { name: "Planches" }).click();
  await expect(page).toHaveURL(/\/platform\/print\/sheets\/pending$/);
  await page.getByRole("link", { name: "Génération libre" }).click();
  await expect(page).toHaveURL(/\/platform\/print\/sheets\/free$/);
}

// Page Planches d'impression — /platform/print/sheets (sous-pages À traiter, Générées, Génération libre)
// Rôle : STAFF_SUPPORT minimum (STAFF_OBSERVER redirigé). La génération est traitée par
// le worker de dev avec le vrai moteur de rendu ; le fichier est servi par /api/files,
// réservé au staff STAFF_SUPPORT+.
test.describe("Platform — Planches d'impression", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("STAFF_OBSERVER est redirigé vers le tableau de bord", async ({ page }) => {
    const observer = await createTestStaff({ scope: "sheets-observer", role: "STAFF_OBSERVER" });
    await loginAndEnter(page, observer, { kind: "platform" });
    // L'entrée de nav est visible de tous les staffs : l'observateur est refusé à l'arrivée.
    await page.getByRole("link", { name: "Planches" }).click();
    await expect(page).toHaveURL(/\/platform$/);
  });

  test("STAFF_SUPPORT génère les planches d'un évènement et télécharge le PDF", async ({ page }) => {
    test.setTimeout(180_000);
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "sheets-gen" });
    const layout = await createTestPrintLayout({ scope: "sheets-gen" });
    const total = 10;
    for (let i = 0; i < total; i++) {
      const u = await createTestUser({ scope: `sheets-gen-${i}`, verified: true, profile: true });
      await createTestRegistration({ eventId, userId: u.id, categoryId, status: "APPROVED" });
    }
    const support = await createTestStaff({ scope: "sheets-support", role: "STAFF_SUPPORT" });

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
    const support = await createTestStaff({ scope: "sheets-order-support", role: "STAFF_SUPPORT" });

    await loginAndEnter(page, support, { kind: "platform" });
    await page.getByRole("link", { name: "Planches" }).click();
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

  test("Sans gabarit sélectionné ni badge, « Générer » reste désactivé", async ({ page }) => {
    const support = await createTestStaff({ scope: "sheets-disabled", role: "STAFF_SUPPORT" });
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
