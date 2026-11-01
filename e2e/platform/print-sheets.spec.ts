import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestPrintLayout,
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

// Page Planches d'impression — /platform/print/sheets
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
    await page.getByRole("link", { name: "Planches" }).click();
    await expect(page).toHaveURL(/\/platform\/print\/sheets/);

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

  test("Sans gabarit sélectionné ni badge, « Générer » reste désactivé", async ({ page }) => {
    const support = await createTestStaff({ scope: "sheets-disabled", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });
    await page.getByRole("link", { name: "Planches" }).click();
    await expect(page).toHaveURL(/\/platform\/print\/sheets/);
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
