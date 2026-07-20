import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestOrgMember,
  createTestCategoryTemplate,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

// Page Modeles de categories — /org/[orgId]/templates
// Nav : MANAGER+. CRUD API : MANAGER (autorise en v4).
// Toutes les actions passent par une modale (Ajouter / Editer) ou un confirm().
test.describe("Org — Modeles de categories", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("OWNER voit le tableau des modeles", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "tpl-render" });
    await createTestCategoryTemplate({ orgId, name: "Visiteur", color: "#4f46e5", number: 1 });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/templates`);
    await expect(page.getByRole("heading", { name: /modèles/i }).first()).toBeVisible();
    await expect(page.getByText("Visiteur")).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("OWNER cree un modele via la modale", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "tpl-create" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/templates`);
    await page.getByRole("button", { name: /^ajouter$/i }).click();
    await expect(page.getByRole("heading", { name: /nouveau modèle/i })).toBeVisible();

    await page.getByRole("textbox", { name: "Nom" }).fill("Presse UI");
    await page.getByLabel("Numéro").fill("42");
    await page.getByRole("button", { name: /^créer$/i }).click();

    // La modale se ferme et la ligne apparait.
    await expect(page.getByRole("heading", { name: /nouveau modèle/i })).toHaveCount(0);
    await expect(page.getByText("Presse UI")).toBeVisible();

    const tpl = await getDb().categoryTemplate.findFirst({ where: { orgId, name: "Presse UI" } });
    expect(tpl?.number).toBe(42);

    await expectLastActivity({
      type: "CATEGORY_TEMPLATE_CREATED",
      orgId,
      userId: owner.id,
      targetId: tpl!.id,
    });
  });

  test("OWNER edite un modele via la modale", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "tpl-edit" });
    const tpl = await createTestCategoryTemplate({
      orgId,
      name: "Nom initial UI",
      color: "#111111",
      number: 20,
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/templates`);
    const row = page.locator("tr", { hasText: "Nom initial UI" });
    await row.getByRole("button", { name: /éditer/i }).click();
    await expect(page.getByRole("heading", { name: /modifier le modèle/i })).toBeVisible();

    await page.getByRole("textbox", { name: "Nom" }).fill("Nom modifie UI");
    await page.getByRole("button", { name: /^enregistrer$/i }).click();

    await expect(page.getByText("Nom modifie UI")).toBeVisible();
    await expect(page.getByText("Nom initial UI")).toHaveCount(0);

    const after = await getDb().categoryTemplate.findUnique({ where: { id: tpl.id } });
    expect(after?.name).toBe("Nom modifie UI");

    await expectLastActivity({
      type: "CATEGORY_TEMPLATE_UPDATED",
      orgId,
      userId: owner.id,
      targetId: tpl.id,
    });
  });

  test("OWNER supprime un modele via le bouton Supprimer", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "tpl-delete" });
    const tpl = await createTestCategoryTemplate({
      orgId,
      name: "A supprimer UI",
      color: "#222222",
      number: 21,
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/templates`);
    await expect(page.getByText("A supprimer UI")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    const row = page.locator("tr", { hasText: "A supprimer UI" });
    await row.getByRole("button", { name: /supprimer/i }).click();

    await expect(page.getByText("A supprimer UI")).toHaveCount(0);
    expect(await getDb().categoryTemplate.findUnique({ where: { id: tpl.id } })).toBeNull();

    await expectLastActivity({
      type: "CATEGORY_TEMPLATE_DELETED",
      orgId,
      userId: owner.id,
      targetId: tpl.id,
    });
  });

  // --- Etats --------------------------------------------------------------

  test("Etat vide : aucun modele", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "tpl-empty" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/templates`);
    await expect(page.getByText(/aucun modèle/i)).toBeVisible();
  });

  // --- Gardes & API -------------------------------------------------------

  test("MANAGER cree un modele -> 201 (autorise en v4)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "tpl-mgr" });
    const manager = await createTestOrgMember({ scope: "tpl-mgr-user", orgId, role: "MANAGER" });
    await loginAs(page, manager);

    const res = await page.request.post(`/api/org/${orgId}/templates`, {
      data: { name: `Mgr ${Date.now()}`, color: "#333333", number: 30 },
    });
    expect(res.status()).toBe(201);
  });

  test("AUDITOR POST /templates -> 403", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "tpl-aud" });
    const auditor = await createTestOrgMember({ scope: "tpl-aud-user", orgId, role: "AUDITOR" });
    await loginAs(page, auditor);

    const res = await page.request.post(`/api/org/${orgId}/templates`, {
      data: { name: `Aud ${Date.now()}`, color: "#444444", number: 31 },
    });
    expect(res.status()).toBe(403);
  });

  test("AUDITOR GET /templates -> 200 (lecture autorisee)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "tpl-aud-read" });
    const auditor = await createTestOrgMember({
      scope: "tpl-aud-read-user",
      orgId,
      role: "AUDITOR",
    });
    await loginAs(page, auditor);

    const res = await page.request.get(`/api/org/${orgId}/templates`);
    expect(res.status()).toBe(200);
  });

  test("Modele d'une autre org -> 404 (scoping)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "tpl-scope-a" });
    const { orgId: otherOrgId } = await createTestOrgWithOwner({ scope: "tpl-scope-b" });
    const foreign = await createTestCategoryTemplate({
      orgId: otherOrgId,
      name: "Etranger",
      color: "#555555",
      number: 32,
    });
    await loginAs(page, owner);

    const res = await page.request.patch(`/api/org/${orgId}/templates/${foreign.id}`, {
      data: { name: "Pirate" },
    });
    expect(res.status()).toBe(404);
  });
});
