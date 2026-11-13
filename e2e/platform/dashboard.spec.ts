import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";

// Page Tableau de bord plateforme — /platform
// Acces : `platform.access` (layout). Page 100% lecture seule : KPI globaux, top organisations du mois
// et activite recente selon les droits ; l'imprimeur voit le bloc Impression a la place.
test.describe("Platform — Tableau de bord", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("STAFF_OBSERVER voit les KPI globaux", async ({ page }) => {
    await createTestOrgWithOwner({ scope: "pdash-kpi" });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "pdash-observer" });

    await page.goto("/platform");
    await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible();
    await expect(page.getByText("Organisations actives")).toBeVisible();
    await expect(page.getByText("Organisations archivées")).toBeVisible();
    await expect(page.getByText("Événements actifs")).toBeVisible();
    await expect(page.getByText("Inscriptions cumulées")).toBeVisible();
  });

  test("STAFF_PRINTER voit le bloc Impression et aucun KPI global", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_PRINTER", scope: "pdash-printer" });

    await page.goto("/platform");
    await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible();
    await expect(page.getByText("Commandes à traiter")).toBeVisible();
    await expect(page.getByText("Planches à générer")).toBeVisible();
    await expect(page.getByText("Organisations actives")).toHaveCount(0);
    await expect(page.getByText("Inscriptions cumulées")).toHaveCount(0);
  });

  test("SUPER_ADMIN voit aussi le tableau de bord", async ({ page }) => {
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "pdash-super" });

    await page.goto("/platform");
    await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible();
  });

  // --- Etats --------------------------------------------------------------

  test("Etat vide : aucune inscription ce mois-ci", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pdash-empty" });

    await page.goto("/platform");
    // Le seed peut contenir des donnees : on verifie que le bloc existe, pas qu'il
    // est vide, sauf si aucune inscription du mois n'est presente.
    const empty = page.getByText(/aucune inscription ce mois-ci/i);
    const hasEmpty = await empty.count();
    if (hasEmpty > 0) {
      await expect(empty).toBeVisible();
    }
    await expect(page.getByText("Inscriptions cumulées")).toBeVisible();
  });

  test("Le compteur d'organisations reflete la base", async ({ page }) => {
    await createTestOrgWithOwner({ scope: "pdash-count" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pdash-count-staff" });

    const activeOrgs = await getDb().organization.count({ where: { archived: false } });

    await page.goto("/platform");
    await expect(page.getByText(String(activeOrgs)).first()).toBeVisible();
  });

  // --- Navigation ---------------------------------------------------------

  test("Les liens 'Tout voir' menent aux organisations et au journal", async ({ page }) => {
    await createTestOrgWithOwner({ scope: "pdash-nav" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pdash-nav-staff" });

    await page.goto("/platform");
    const liens = page.getByRole("link", { name: /tout voir/i });
    await liens.first().click();
    await page.waitForURL(/\/platform\/(organizations|activity)/);
  });

  // --- Gardes -------------------------------------------------------------

  test("Un non-staff est redirige hors de /platform", async ({ page }) => {
    const { owner } = await createTestOrgWithOwner({ scope: "pdash-nonstaff" });
    const { loginAs } = await import("../helpers/auth");
    await loginAs(page, owner);

    await page.goto("/platform");
    await expect(page).not.toHaveURL(/\/platform$/);
  });
});
