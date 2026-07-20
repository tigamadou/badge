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

  test("ADMIN cree une categorie via POST API + audit CATEGORY_CREATED", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "cat-create" });
    const admin = await makeEventAdminUser({ scope: "cat-create", eventId, orgId });
    await loginAs(page, admin);

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/categories`,
      { data: { name: "Sponsor", color: "#ff8800", number: 7 } },
    );
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.category.name).toBe("Sponsor");

    const log = await expectLastActivity({
      type: "CATEGORY_CREATED",
      userId: admin.id,
      eventId,
      targetId: body.category.id,
    });
    expect(log).toBeTruthy();
  });

  test("Collision number renvoie 409 NUMBER_TAKEN", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "cat-collision" });
    const admin = await makeEventAdminUser({ scope: "cat-collision", eventId, orgId });
    await loginAs(page, admin);

    // createTestEvent cree deja une categorie avec number=1.
    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/categories`,
      { data: { name: "Doublon", color: "#000000", number: 1 } },
    );
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NUMBER_TAKEN");
  });

  test("ADMIN importe templates org via /import-templates + audit source=template", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "cat-import" });
    const admin = await makeEventAdminUser({ scope: "cat-import", eventId, orgId });
    await loginAs(page, admin);

    const tpl1 = await createTestCategoryTemplate({
      orgId,
      name: "VIP-Imp",
      color: "#aa0000",
      number: 50,
    });
    const tpl2 = await createTestCategoryTemplate({
      orgId,
      name: "Press-Imp",
      color: "#0000aa",
      number: 51,
    });

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/categories/import-templates`,
      { data: { templateIds: [tpl1.id, tpl2.id] } },
    );
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.categories).toHaveLength(2);

    // BDD : 2 nouvelles categories sur l'event (en plus de celle creee par createTestEvent).
    const db = getDb();
    const cats = await db.category.findMany({ where: { eventId } });
    expect(cats.length).toBeGreaterThanOrEqual(3);

    // Audit : 2 CATEGORY_CREATED avec details.source = "template"
    for (const c of body.categories) {
      const log = await expectLastActivity({
        type: "CATEGORY_CREATED",
        userId: admin.id,
        eventId,
        targetId: c.id,
      });
      expect((log.details as { source?: string })?.source).toBe("template");
    }
  });

  test("ADMIN edite une categorie via PATCH + audit CATEGORY_UPDATED", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "cat-edit" });
    const admin = await makeEventAdminUser({ scope: "cat-edit", eventId, orgId });
    await loginAs(page, admin);

    const cat = await createTestCategory({ eventId, name: "ToEdit", number: 20 });

    const res = await page.request.patch(
      `/api/org/${orgId}/events/${eventId}/categories/${cat.id}`,
      { data: { name: "Edited Name" } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.category.name).toBe("Edited Name");

    await expectLastActivity({
      type: "CATEGORY_UPDATED",
      userId: admin.id,
      eventId,
      targetId: cat.id,
    });
  });

  test("ADMIN supprime une categorie sans inscriptions + audit CATEGORY_DELETED", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "cat-delete" });
    const admin = await makeEventAdminUser({ scope: "cat-delete", eventId, orgId });
    await loginAs(page, admin);

    const cat = await createTestCategory({ eventId, name: "ToDelete", number: 30 });

    const res = await page.request.delete(
      `/api/org/${orgId}/events/${eventId}/categories/${cat.id}`,
    );
    expect(res.status()).toBe(204);

    const db = getDb();
    const gone = await db.category.findUnique({ where: { id: cat.id } });
    expect(gone).toBeNull();

    await expectLastActivity({
      type: "CATEGORY_DELETED",
      userId: admin.id,
      eventId,
      targetId: cat.id,
    });
  });

  test("Suppression refusee si inscriptions liees (409 CATEGORY_HAS_REGISTRATIONS)", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "cat-del-blocked" });
    const admin = await makeEventAdminUser({ scope: "cat-del-blocked", eventId, orgId });
    const participant = await createTestUser({
      scope: "cat-del-part",
      verified: true,
      profile: true,
    });
    await loginAs(page, admin);

    const cat = await createTestCategory({ eventId, name: "HasRegs", number: 40 });
    await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId: cat.id,
      status: "PENDING",
    });

    const res = await page.request.delete(
      `/api/org/${orgId}/events/${eventId}/categories/${cat.id}`,
    );
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("CATEGORY_HAS_REGISTRATIONS");
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
