import { test, expect, type Page } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestInstalledTemplate,
  createTestStaff,
  disconnectDb,
  E2E_LAYOUT_PREFIX,
  getDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { toast } from "../helpers/feedback";

// Les <Select> de l'application n'associent pas leur libellé au champ (pas de for/id) :
// on cible le <select> qui suit le <label>.
function selectByLabel(page: Page, label: string) {
  return page.locator("label", { hasText: label }).locator("xpath=following-sibling::select").first();
}

// Gabarits d'impression : liste /platform/print/layouts, editeur /new et /[layoutId].
// Ecriture : STAFF_ADMIN ; lecture seule : STAFF_OBSERVER (lien « Voir »). Le badge temoin
// n'existe que dans l'editeur ; la liste n'affiche que les gabarits.
// Le badge temoin « Taille libre » 84 x 120 mm donne 9 badges par feuille sur un A3
// (marges 10 mm, sans espace).
test.describe("Platform — Gabarits d'impression", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function goToLayouts(page: Page, scope: string, role: "STAFF_ADMIN" | "STAFF_OBSERVER") {
    const staff = await createTestStaff({ scope, role });
    await loginAndEnter(page, staff, { kind: "platform" });
    await page.getByRole("link", { name: "Gabarits" }).click();
    await expect(page).toHaveURL(/\/platform\/print\/layouts/);
    return staff;
  }

  async function useFreeBadge(page: Page) {
    await selectByLabel(page, "Template installé").selectOption("free");
    await page.getByLabel("Largeur du badge (mm)").fill("84");
    await page.getByLabel("Hauteur du badge (mm)").fill("120");
  }

  test("STAFF_ADMIN crée un gabarit A3, modifie une marge puis l'archive", async ({ page }) => {
    const staff = await goToLayouts(page, "layouts-admin", "STAFF_ADMIN");
    const name = `${E2E_LAYOUT_PREFIX}A3 ${Date.now()}`;

    await page.getByRole("link", { name: "Nouveau gabarit" }).click();
    await expect(page).toHaveURL(/\/platform\/print\/layouts\/new/);
    await useFreeBadge(page);
    await page.getByLabel("Nom", { exact: true }).fill(name);
    await page.getByRole("radio", { name: /^A3/ }).click();
    await expect(page.getByRole("radio", { name: /^A3/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("9 badges par feuille").first()).toBeVisible();

    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(toast(page, "Gabarit créé.")).toBeVisible();
    await expect(page).toHaveURL(/\/platform\/print\/layouts$/);
    const row = page.locator("li", { hasText: name });
    await expect(row).toContainText("297 × 420 mm");
    await expect(row).toContainText("Marges 10 mm");
    await expect(page.getByText("badges par feuille")).toHaveCount(0);

    const created = await getDb().printSheetLayout.findUnique({ where: { name } });
    expect(created).toMatchObject({
      sheetWidth: 2970,
      sheetHeight: 4200,
      marginTop: 100,
      archived: false,
      createdById: staff.id,
    });

    // Modification d'une marge, marges dissociees : seule la marge gauche change.
    await row.getByRole("link", { name: "Modifier" }).click();
    await expect(page).toHaveURL(new RegExp(`/platform/print/layouts/${created?.id}`));
    await page.getByRole("switch", { name: "Marges identiques" }).click();
    await page.getByLabel("Marge gauche (mm)").fill("25");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(toast(page, "Gabarit mis à jour.")).toBeVisible();
    const updated = await getDb().printSheetLayout.findUnique({ where: { name } });
    expect(updated).toMatchObject({ marginLeft: 250, marginRight: 100 });

    await row.getByRole("button", { name: "Archiver" }).click();
    await expect(toast(page, "Gabarit archivé.")).toBeVisible();
    await expect(page.locator("li", { hasText: name })).toHaveCount(0);
    const archived = await getDb().printSheetLayout.findUnique({ where: { name } });
    expect(archived?.archived).toBe(true);
    expect(archived?.archivedAt).not.toBeNull();
  });

  test("Un nom déjà utilisé est refusé avec son message, sans second gabarit", async ({ page }) => {
    await goToLayouts(page, "layouts-dup", "STAFF_ADMIN");
    const name = `${E2E_LAYOUT_PREFIX}doublon ${Date.now()}`;
    await getDb().printSheetLayout.create({
      data: {
        name, sheetWidth: 2100, sheetHeight: 2970, sheetOrientation: "PORTRAIT",
        marginTop: 100, marginRight: 100, marginBottom: 100, marginLeft: 100,
        gapHorizontal: 0, gapVertical: 0,
      },
    });

    await page.reload();
    await page.getByRole("link", { name: "Nouveau gabarit" }).click();
    await page.getByLabel("Nom", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Ce nom de gabarit existe déjà.")).toBeVisible();
    expect(await getDb().printSheetLayout.count({ where: { name } })).toBe(1);
  });

  test("Le badge témoin indique si le template est recto-verso", async ({ page }) => {
    const staff = await goToLayouts(page, "layouts-duplex", "STAFF_ADMIN");
    const stamp = Date.now();
    const duplex = await createTestInstalledTemplate({
      installedById: staff.id,
      label: `E2E recto-verso ${stamp}`,
      pages: 2,
    });
    const single = await createTestInstalledTemplate({
      installedById: staff.id,
      label: `E2E recto seul ${stamp}`,
    });
    await page.getByRole("link", { name: "Nouveau gabarit" }).click();
    await expect(page).toHaveURL(/\/platform\/print\/layouts\/new/);

    await selectByLabel(page, "Template installé").selectOption(duplex.id);
    await expect(page.getByText("Recto-verso", { exact: true })).toBeVisible();
    await expect(page.getByText(/chaque verso est placé derrière son recto/i)).toBeVisible();

    await selectByLabel(page, "Template installé").selectOption(single.id);
    await expect(page.getByText("Recto seul", { exact: true })).toBeVisible();
    await expect(page.getByText("Recto-verso", { exact: true })).toHaveCount(0);

    // Taille libre : pas de template, donc rien a annoncer.
    await selectByLabel(page, "Template installé").selectOption("free");
    await expect(page.getByText("Recto seul", { exact: true })).toHaveCount(0);
  });

  test("STAFF_OBSERVER voit la liste sans bouton d'écriture", async ({ page }) => {
    await goToLayouts(page, "layouts-observer", "STAFF_OBSERVER");
    await expect(page.getByText("Badge témoin")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Nouveau gabarit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Archiver" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Modifier" })).toHaveCount(0);
    // L'acces direct a la creation renvoie a la liste.
    await page.goto("/platform/print/layouts/new");
    await expect(page).toHaveURL(/\/platform\/print\/layouts$/);
  });
});
