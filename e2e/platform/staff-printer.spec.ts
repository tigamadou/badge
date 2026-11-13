import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestPrintProduct,
  createTestPrintRequest,
  createTestStaff,
  createTestUser,
  disconnectDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { loginAsStaff } from "../helpers/auth";

// Rôle STAFF_PRINTER (imprimeur) : accès à la production d'impression seulement (commandes, planches,
// gabarits, catalogue), sans les espaces d'administration de la plateforme.
test.describe("Platform — Imprimeur", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("le menu est limité à la production, sans groupe Plateforme ni Rôles", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_PRINTER", scope: "printer-nav" });
    await page.goto("/platform");

    const nav = page.getByRole("navigation").first();
    for (const name of ["Tableau de bord", "Notifications", "Commandes", "Planches", "Gabarits", "Catalogue"]) {
      await expect(nav.getByRole("link", { name: new RegExp(`^${name}`) }), name).toBeVisible();
    }
    for (const name of ["Organisations", "Profils", "Plans", "Paiements", "Utilisateurs", "Templates de badge", "Emails", "Journal", "Paramètres", "Rôles"]) {
      await expect(nav.getByRole("link", { name: new RegExp(`^${name}`) }), name).toHaveCount(0);
    }
    await expect(nav.getByText("Plateforme", { exact: true })).toHaveCount(0);
  });

  test("les espaces d'administration renvoient au tableau de bord en URL directe", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_PRINTER", scope: "printer-direct" });
    for (const path of ["organizations", "settings", "plans", "payments", "jobs", "activity"]) {
      await page.goto(`/platform/${path}`);
      await expect(page, path).toHaveURL(/\/platform$/);
    }
  });

  test("sur une commande payée : démarrer la production, sans devis ni paiement", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "printer-order" });
    const organizer = await createTestUser({ scope: "printer-order-org", verified: true });
    const badge = await createTestPrintProduct({ name: "e2e-Badge printer", kind: "BADGE" });
    const request = await createTestPrintRequest({
      eventId,
      orgId,
      createdById: organizer.id,
      status: "PAID",
      lines: [{ label: "Support badge PVC", quantity: 1, unitPrice: 1500, kind: "PRODUCT", productId: badge.id }],
    });
    const printer = await createTestStaff({ scope: "printer-order-staff", role: "STAFF_PRINTER" });

    await loginAndEnter(page, printer, { kind: "platform" });
    await page.goto(`/platform/print/orders/${request.id}`);
    await expect(page.getByRole("button", { name: "Passer en production" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Envoyer le devis" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Marquer payée" })).toHaveCount(0);
  });
});
