import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestCategory,
  createTestCategoryTemplate,
  createTestEvent,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

// Page Categories — /event/[eventId]/categories
// Rôle : ADMIN. Actions : Ajouter (modale), Editer (modale), Supprimer (confirm),
// Importer un modele (modale depuis les modeles de l'org).
// Garde-fous : 409 NUMBER_TAKEN, 409 CATEGORY_HAS_REGISTRATIONS.
test.describe("Event — Categories", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });







  // --- Actions UI ---------------------------------------------------------

  test("ADMIN cree une categorie via la modale", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "cat-ui-create" });
    const admin = await makeEventAdminUser({ scope: "cat-ui-create", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/categories`);
    await page.getByRole("button", { name: /ajouter/i }).click();
    await expect(page.getByRole("heading", { name: /nouvelle catégorie/i })).toBeVisible();

    const catName = `Presse UI ${Date.now()}`;
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill(catName);
    await page.getByLabel("Numéro").fill("77");
    await page.getByRole("button", { name: "Créer", exact: true }).click();

    await expect(page.getByRole("heading", { name: /nouvelle catégorie/i })).toBeHidden();
    await expect(page.getByText(catName)).toBeVisible();

    const created = await getDb().category.findFirst({ where: { eventId, name: catName } });
    expect(created?.number).toBe(77);

    await expectLastActivity({
      type: "CATEGORY_CREATED",
      userId: admin.id,
      eventId,
      targetId: created!.id,
    });
  });

  test("ADMIN edite une categorie via la modale", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "cat-ui-edit" });
    const cat = await createTestCategory({
      eventId,
      name: "Cat initiale UI",
      color: "#123456",
      number: 78,
    });
    const admin = await makeEventAdminUser({ scope: "cat-ui-edit", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/categories`);
    const row = page.locator("tr", { hasText: "Cat initiale UI" });
    await row.getByLabel("Éditer").click();

    await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Cat modifiee UI");
    await page.getByRole("button", { name: /^enregistrer$/i }).click();

    await expect(page.getByText("Cat modifiee UI")).toBeVisible();
    const after = await getDb().category.findUnique({ where: { id: cat.id } });
    expect(after?.name).toBe("Cat modifiee UI");
  });

  test("ADMIN supprime une categorie via le bouton", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "cat-ui-del" });
    const cat = await createTestCategory({
      eventId,
      name: "Cat a supprimer UI",
      color: "#654321",
      number: 79,
    });
    const admin = await makeEventAdminUser({ scope: "cat-ui-del", eventId, orgId });
    await loginAs(page, admin);
    page.on("dialog", (d) => d.accept());

    await page.goto(`/event/${eventId}/categories`);
    const row = page.locator("tr", { hasText: "Cat a supprimer UI" });
    await row.getByLabel("Supprimer").click();

    await expect(page.getByText("Cat a supprimer UI")).toHaveCount(0);
    expect(await getDb().category.findUnique({ where: { id: cat.id } })).toBeNull();
  });

  test("ADMIN importe des modeles via la modale", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "cat-ui-import" });
    await createTestCategoryTemplate({ orgId, name: "Modele UI", color: "#abcdef", number: 80 });
    const admin = await makeEventAdminUser({ scope: "cat-ui-import", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/categories`);
    await page.getByRole("button", { name: /importer un modèle/i }).click();
    await expect(
      page.getByRole("heading", { name: /importer des modèles de catégories/i }),
    ).toBeVisible();

    // Cocher la case DU modele voulu (chaque modele est un <li>).
    await page.locator("li", { hasText: "Modele UI" }).locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /^importer \(1\)/i }).click();

    // La modale se ferme, puis la categorie importee apparait dans la table.
    await expect(
      page.getByRole("heading", { name: /importer des modèles de catégories/i }),
    ).toBeHidden();
    await expect(async () => {
      expect(
        await getDb().category.findFirst({ where: { eventId, name: "Modele UI" } }),
      ).not.toBeNull();
    }).toPass();
  });

  // --- Etats --------------------------------------------------------------

  test("Etat vide : aucune categorie", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "cat-ui-empty" });
    await getDb().category.delete({ where: { id: categoryId } });
    const admin = await makeEventAdminUser({ scope: "cat-ui-empty", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/categories`);
    await expect(page.getByText(/aucune catégorie/i)).toBeVisible();
  });
});
