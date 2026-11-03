import { test, expect, type Locator, type Page } from "@playwright/test";
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
import { ensureFixtures } from "../fixtures";

// Les onglets de la fiche restent montés (attribut hidden) : on ne manipule que l'élément visible.
const visible = (l: Locator) => l.locator("visible=true");

// Les <Select> de l'application n'associent pas leur libellé au champ (pas de for/id).
function selectsByLabel(page: Page, label: string) {
  return page.locator("label", { hasText: label }).locator("xpath=following-sibling::select");
}

// Page Fiche produit du catalogue — /platform/print/catalog/[productId]
// Ecriture : STAFF_ADMIN ; lecture seule : STAFF_OBSERVER (ni bouton ni champ modifiable).
test.describe("Platform — Fiche produit", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function openProduct(
    page: Page,
    scope: string,
    role: "STAFF_ADMIN" | "STAFF_OBSERVER",
    name: string,
    opts: { published?: boolean } = {},
  ) {
    const product = await createTestPrintProduct({ name, published: opts.published });
    const staff = await createTestStaff({ scope, role });
    await loginAndEnter(page, staff, { kind: "platform" });
    await page.getByRole("link", { name: "Catalogue" }).click();
    await expect(page).toHaveURL(/\/platform\/print\/catalog$/);
    await page.getByRole("cell", { name }).click();
    await expect(page).toHaveURL(new RegExp(`/platform/print/catalog/${product.id}$`));
    await expect(page.getByRole("heading", { name })).toBeVisible();
    return { product, staff };
  }

  async function openTab(page: Page, name: string) {
    await page.getByRole("tab", { name }).click();
    await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
  }

  // Le champ de dépôt n'accepte qu'un fichier à la fois : une image par téléversement.
  async function addImages(page: Page, jpeg: string, from: number, to: number) {
    for (let i = from + 1; i <= to; i += 1) {
      const input = page.locator('input[type="file"]').first();
      // Le champ n'est pas réinitialisé après un dépôt : sans vider, le même fichier ne redéclenche pas « change ».
      await input.setInputFiles([]);
      await input.setInputFiles(jpeg);
      await expect(page.getByRole("button", { name: "Retirer" })).toHaveCount(i);
    }
  }

  test("STAFF_ADMIN monte un cordon complet : 4 images, deux paliers, couleurs, texte, publication, aperçu", async ({ page }) => {
    const fx = ensureFixtures();
    const { product, staff } = await openProduct(page, "product-full", "STAFF_ADMIN", "e2e-Cordon complet");

    // Informations.
    await visible(page.getByLabel("Prix de base (FCFA)")).fill("800");
    await visible(page.getByLabel("Catégorie")).fill("Accessoires");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(toast(page, "Produit enregistré.")).toBeVisible();
    await expectLastActivity({ type: "PRINT_PRODUCT_UPDATED", userId: staff.id, targetId: product.id });

    // Galerie : 4 images.
    await openTab(page, "Galerie");
    await addImages(page, fx.jpeg, 0, 4);
    await expect(page.getByText("JPEG, PNG ou WebP, 5 Mo max · 4/10")).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer la galerie" }).click();
    await expect(toast(page, "Galerie enregistrée.")).toBeVisible();
    expect(await getDb().printProductImage.count({ where: { productId: product.id } })).toBe(4);

    // Tarifs : deux paliers.
    await openTab(page, "Tarifs");
    await page.getByRole("button", { name: "Ajouter un palier" }).click();
    await page.getByRole("button", { name: "Ajouter un palier" }).click();
    await page.getByLabel("Quantité minimale du palier 1").fill("50");
    await page.getByLabel("Prix unitaire du palier 1").fill("650");
    await page.getByLabel("Quantité minimale du palier 2").fill("100");
    await page.getByLabel("Prix unitaire du palier 2").fill("500");
    await page.getByRole("button", { name: "Enregistrer les tarifs" }).click();
    await expect(toast(page, "Tarifs enregistrés.")).toBeVisible();
    const tiers = await getDb().printProductPriceTier.findMany({
      where: { productId: product.id },
      orderBy: { minQuantity: "asc" },
    });
    expect(tiers.map((t) => [t.minQuantity, t.unitPrice])).toEqual([[50, 650], [100, 500]]);

    // Options : COLOR à 5 couleurs (une à +100) et TEXT facturé +100.
    await openTab(page, "Options");
    await page.getByRole("button", { name: "Ajouter une option" }).click();
    await visible(page.getByLabel("Nom", { exact: true })).first().fill("Couleur du cordon");
    await visible(selectsByLabel(page, "Type")).first().selectOption("COLOR");
    const colors = [
      ["Rouge", "#ff0000", "100"],
      ["Bleu", "#0000ff", "0"],
      ["Vert", "#00aa00", "0"],
      ["Noir", "#000000", "0"],
      ["Blanc", "#ffffff", "0"],
    ];
    for (let i = 0; i < colors.length; i += 1) {
      await page.getByRole("button", { name: "Ajouter une valeur" }).click();
      const [label, hex, delta] = colors[i];
      await visible(page.getByLabel("Libellé")).nth(i).fill(label);
      await visible(page.getByLabel(`Couleur de ${label}`)).fill(hex);
      await visible(page.getByLabel("Supplément (FCFA)")).nth(i).fill(delta);
    }
    await page.getByRole("button", { name: "Ajouter une option" }).click();
    await visible(page.getByLabel("Nom", { exact: true })).nth(1).fill("Texte à broder");
    await visible(selectsByLabel(page, "Type")).nth(1).selectOption("TEXT");
    await visible(page.getByLabel("Longueur max (caractères)")).fill("30");
    await visible(page.getByLabel("Supplément (FCFA)")).nth(5).fill("100");
    await page.getByRole("button", { name: "Enregistrer les options" }).click();
    await expect(toast(page, "Options enregistrées.")).toBeVisible();

    const options = await getDb().printProductOption.findMany({
      where: { productId: product.id },
      orderBy: { position: "asc" },
      include: { values: { orderBy: { position: "asc" } } },
    });
    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({ name: "Couleur du cordon", type: "COLOR" });
    expect(options[0].values).toHaveLength(5);
    expect(options[0].values.map((v) => v.priceDelta)).toEqual([100, 0, 0, 0, 0]);
    expect(options[0].values[0]).toMatchObject({ label: "Rouge", colorHex: "#ff0000" });
    expect(options[1]).toMatchObject({ name: "Texte à broder", type: "TEXT", priceDelta: 100, maxLength: 30 });

    // Publication.
    await page.getByRole("switch", { name: "Publié" }).click();
    await expect(toast(page, "Statut mis à jour.")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Publié" })).toHaveAttribute("aria-checked", "true");
    expect((await getDb().printProduct.findUnique({ where: { id: product.id } }))?.published).toBe(true);

    // Aperçu : 100 x (500 + 100 couleur + 100 texte) = 70 000 FCFA.
    await openTab(page, "Aperçu");
    await visible(page.getByLabel("Quantité", { exact: true })).fill("100");
    await page.getByRole("button", { name: /^Rouge \(\+/ }).click();
    await visible(page.getByLabel(/^Texte à broder/)).fill("Salon 2026");
    await expect(page.getByText("Prix unitaire estimé").locator("xpath=following-sibling::strong")).toHaveText("700 FCFA");
    await expect(page.getByText("Total estimé").locator("xpath=following-sibling::strong")).toHaveText("70 000 FCFA");
  });

  test("Un fichier .txt est refusé (« Type interdit ») et aucune image n'est ajoutée", async ({ page }) => {
    const fx = ensureFixtures();
    const { product } = await openProduct(page, "product-badtype", "STAFF_ADMIN", "e2e-Type interdit");
    await openTab(page, "Galerie");

    await page.locator('input[type="file"]').first().setInputFiles(fx.txt);
    await expect(toast(page, "Type interdit")).toBeVisible();
    await expect(page.getByText("Aucune image.")).toBeVisible();
    await expect(page.getByText("JPEG, PNG ou WebP, 5 Mo max · 0/10")).toBeVisible();
    expect(await getDb().printProductImage.count({ where: { productId: product.id } })).toBe(0);
  });

  test("Un fichier de plus de 5 Mo est refusé (« Fichier trop volumineux ») sans image ajoutée", async ({ page }) => {
    const { product } = await openProduct(page, "product-toolarge", "STAFF_ADMIN", "e2e-Trop lourd");
    await openTab(page, "Galerie");

    // JPEG de 5 Mo + 1 octet construit en mémoire (pas de fichier sur disque).
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "trop-lourd.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0),
    });
    await expect(toast(page, "Fichier trop volumineux (5 Mo max)")).toBeVisible();
    await expect(page.getByText("Aucune image.")).toBeVisible();
    expect(await getDb().printProductImage.count({ where: { productId: product.id } })).toBe(0);
  });

  test("À 10 images, la zone de dépôt disparaît", async ({ page }) => {
    const fx = ensureFixtures();
    await openProduct(page, "product-cap", "STAFF_ADMIN", "e2e-Dix images");
    await openTab(page, "Galerie");

    await addImages(page, fx.jpeg, 0, 9);
    await expect(page.getByText("JPEG, PNG ou WebP, 5 Mo max · 9/10")).toBeVisible();
    await addImages(page, fx.jpeg, 9, 10);
    await expect(page.getByText("Ajouter des images")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enregistrer la galerie" })).toBeVisible();
  });

  test("STAFF_ADMIN archive un produit : retour à la liste, absent de la vue par défaut", async ({ page }) => {
    const { product, staff } = await openProduct(page, "product-archive", "STAFF_ADMIN", "e2e-A archiver");

    await page.getByRole("button", { name: "Archiver", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Archiver ce produit ?")).toBeVisible();
    await dialog.getByRole("button", { name: "Archiver" }).click();

    await expect(toast(page, "Produit archivé.")).toBeVisible();
    await expect(page).toHaveURL(/\/platform\/print\/catalog$/);
    await expect(page.getByRole("cell", { name: "e2e-A archiver" })).toHaveCount(0);

    const archived = await getDb().printProduct.findUnique({ where: { id: product.id } });
    expect(archived?.archived).toBe(true);
    expect(archived?.archivedAt).not.toBeNull();
    await expectLastActivity({ type: "PRINT_PRODUCT_ARCHIVED", userId: staff.id, targetId: product.id });

    await page.getByRole("button", { name: "Archivés" }).click();
    await expect(page).toHaveURL(/\/platform\/print\/catalog\?archived=true$/);
    await expect(page.getByRole("cell", { name: "e2e-A archiver" })).toBeVisible();
  });

  test("STAFF_OBSERVER consulte la fiche sans aucun bouton d'écriture", async ({ page }) => {
    await openProduct(page, "product-observer", "STAFF_OBSERVER", "e2e-Observé");

    await expect(page.getByRole("switch", { name: "Publié" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Archiver" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toHaveCount(0);
    await expect(visible(page.getByLabel("Nom", { exact: true }))).toBeDisabled();

    await openTab(page, "Galerie");
    await expect(page.getByRole("button", { name: "Enregistrer la galerie" })).toHaveCount(0);
    await expect(page.getByText("Ajouter des images")).toHaveCount(0);
    await openTab(page, "Options");
    await expect(page.getByRole("button", { name: "Ajouter une option" })).toHaveCount(0);
  });
});
