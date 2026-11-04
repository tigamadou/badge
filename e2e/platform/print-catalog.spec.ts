import { test, expect, type Page } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestPrintProduct,
  createTestStaff,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { expectLastActivity } from "../helpers/audit";
import { toast } from "../helpers/feedback";

// Les <Select> de l'application n'associent pas leur libellé au champ (pas de for/id) :
// on cible le <select> qui suit le <label>.
function selectByLabel(page: Page, label: string) {
  return page.locator("label", { hasText: label }).locator("xpath=following-sibling::select").first();
}

// Page Catalogue d'impression — /platform/print/catalog
// Ecriture : STAFF_ADMIN ; lecture seule : STAFF_OBSERVER (pas de « Nouveau produit »).
test.describe("Platform — Catalogue d'impression", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function goToCatalog(page: Page, scope: string, role: "STAFF_ADMIN" | "STAFF_OBSERVER") {
    const staff = await createTestStaff({ scope, role });
    await loginAndEnter(page, staff, { kind: "platform" });
    await page.getByRole("link", { name: "Catalogue" }).click();
    await expect(page).toHaveURL(/\/platform\/print\/catalog$/);
    await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();
    return staff;
  }

  test("Les vues Actifs et Archivés séparent les produits", async ({ page }) => {
    // Hermétique : on ne s'appuie que sur les produits créés ici, jamais sur le contenu de la base.
    const active = await createTestPrintProduct({ name: "e2e-Vue-actif" });
    const archived = await createTestPrintProduct({ name: "e2e-Vue-archive" });
    await getDb().printProduct.update({ where: { id: archived.id }, data: { archived: true, archivedAt: new Date() } });
    await goToCatalog(page, "catalog-views", "STAFF_ADMIN");
    // Le catalogue est paginé (20 par défaut) et la base e2e partagée contient d'autres produits.
    await page.goto("/platform/print/catalog?pageSize=500");
    await expect(page.getByRole("link", { name: "e2e-Vue-actif" })).toBeVisible();
    await expect(page.getByText("e2e-Vue-archive")).toHaveCount(0);

    await page.getByRole("button", { name: "Archivés" }).click();
    // Changer de vue conserve la taille de page.
    await expect(page).toHaveURL(/\/platform\/print\/catalog\?archived=true&pageSize=500$/);
    await expect(page.getByRole("link", { name: "e2e-Vue-archive" })).toBeVisible();
    await expect(page.getByText("e2e-Vue-actif")).toHaveCount(0);
    expect(active.id).not.toBe(archived.id);
  });

  test("STAFF_ADMIN crée un produit en brouillon et arrive sur sa fiche", async ({ page }) => {
    const staff = await goToCatalog(page, "catalog-create", "STAFF_ADMIN");

    await page.getByRole("button", { name: "Nouveau produit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nom", { exact: true }).fill("e2e-Cordon");
    await selectByLabel(page, "Famille").selectOption("ACCESSORY");
    await dialog.getByLabel("Prix de base (FCFA)").fill("800");
    await dialog.getByRole("button", { name: "Créer" }).click();

    await expect(toast(page, "Produit créé.")).toBeVisible();
    await expect(page).toHaveURL(/\/platform\/print\/catalog\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: "e2e-Cordon" })).toBeVisible();
    await expect(page.getByText("Brouillon").first()).toBeVisible();

    const created = await getDb().printProduct.findFirst({ where: { name: "e2e-Cordon" } });
    expect(created).toMatchObject({ kind: "ACCESSORY", basePrice: 800, published: false, archived: false });
    await expectLastActivity({
      type: "PRINT_PRODUCT_CREATED",
      userId: staff.id,
      targetId: created!.id,
    });
  });

  test("Le filtre « Accessoires » masque un support de badge", async ({ page }) => {
    await createTestPrintProduct({ name: "e2e-Support PVC", kind: "BADGE" });
    await createTestPrintProduct({ name: "e2e-Porte-badge", kind: "ACCESSORY" });
    await goToCatalog(page, "catalog-filter", "STAFF_ADMIN");

    await expect(page.getByRole("cell", { name: "e2e-Support PVC" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "e2e-Porte-badge" })).toBeVisible();

    await page.getByRole("button", { name: "Accessoires" }).click();
    await expect(page).toHaveURL(/\/platform\/print\/catalog\?kind=ACCESSORY$/);
    await expect(page.getByRole("cell", { name: "e2e-Porte-badge" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "e2e-Support PVC" })).toHaveCount(0);

    await page.getByRole("button", { name: "Supports de badge" }).click();
    await expect(page).toHaveURL(/\/platform\/print\/catalog\?kind=BADGE$/);
    await expect(page.getByRole("cell", { name: "e2e-Support PVC" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "e2e-Porte-badge" })).toHaveCount(0);
  });

  test("STAFF_OBSERVER voit la liste sans bouton « Nouveau produit »", async ({ page }) => {
    await createTestPrintProduct({ name: "e2e-Lecture seule" });
    await goToCatalog(page, "catalog-observer", "STAFF_OBSERVER");
    await expect(page.getByRole("cell", { name: "e2e-Lecture seule" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nouveau produit" })).toHaveCount(0);
  });
});
