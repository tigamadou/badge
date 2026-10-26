import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestCategoryTemplate,
  disconnectDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { toast, countRequests, failWith500Html } from "../helpers/feedback";

// Loader et toast sur les actions de /org (spec 28).
test.describe("Feedback — /org", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("double clic sur « Enregistrer » : un seul PATCH", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "fb-org-dbl" });
    await loginAs(page, owner);
    const patches = countRequests(page, "PATCH", `/api/org/${orgId}`);

    await page.goto(`/org/${orgId}/settings`);
    await page.getByLabel("Ville").fill("Abidjan");
    await page.getByRole("button", { name: /^enregistrer$/i }).dblclick();

    await expect(toast(page, "Paramètres enregistrés.")).toBeVisible();
    expect(patches()).toBe(1);
  });

  test("erreur 500 à la suppression d'un modèle : toast de repli, la ligne reste", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "fb-org-tpl-500" });
    await createTestCategoryTemplate({ orgId, name: "Modèle feedback", color: "#4f46e5", number: 1 });
    await loginAs(page, owner);
    await failWith500Html(page, "**/api/org/*/templates/*");
    page.on("dialog", (d) => d.accept());

    await page.goto(`/org/${orgId}/templates`);
    await page.getByRole("button", { name: "Supprimer" }).click();

    await expect(toast(page, "Échec de la suppression du modèle.")).toBeVisible();
    await expect(page.getByText("Modèle feedback")).toBeVisible();
  });

  test("annuler le confirm de suppression : aucune requête, aucun toast", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "fb-org-tpl-cancel" });
    await createTestCategoryTemplate({ orgId, name: "Modèle gardé", color: "#4f46e5", number: 1 });
    await loginAs(page, owner);
    page.on("dialog", (d) => d.dismiss());
    const deletes = countRequests(page, "DELETE", "/templates/");

    await page.goto(`/org/${orgId}/templates`);
    await page.getByRole("button", { name: "Supprimer" }).click();

    await page.waitForTimeout(500);
    expect(deletes()).toBe(0);
    await expect(toast(page, /./)).toHaveCount(0);
    await expect(page.getByText("Modèle gardé")).toBeVisible();
  });
});
