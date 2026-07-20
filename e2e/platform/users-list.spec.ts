import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestUser, disconnectDb, getDb } from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";

// Page Utilisateurs (liste) — /platform/users
// Rôle mini : STAFF_OBSERVER pour consulter. Filtres en GET (form) : recherche `q`,
// select type (all / staff / client), case « Archivés ». Aucune mutation ici.
test.describe("Platform — Utilisateurs (liste)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("STAFF voit la liste et le lien de creation", async ({ page }) => {
    const user = await createTestUser({ scope: "pusers-render", verified: true });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pusers-render-staff" });

    await page.goto("/platform/users");
    await expect(page.getByText(user.email)).toBeVisible();
    await expect(page.getByRole("link", { name: /créer un utilisateur/i })).toBeVisible();
  });

  // --- Filtres ------------------------------------------------------------

  test("Recherche par e-mail : filtre la table", async ({ page }) => {
    const cible = await createTestUser({ scope: "pusers-hit", verified: true });
    const autre = await createTestUser({ scope: "pusers-miss", verified: true });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pusers-search-staff" });

    await page.goto("/platform/users");
    await expect(page.getByText(autre.email)).toBeVisible();

    await page.getByPlaceholder(/rechercher un utilisateur/i).fill(cible.email);
    await page.getByRole("button", { name: /^filtrer$/i }).click();

    await expect(page.getByText(cible.email)).toBeVisible();
    await expect(page.getByText(autre.email)).toHaveCount(0);
  });

  test("Filtre type=staff : n'affiche que le staff", async ({ page }) => {
    const client = await createTestUser({ scope: "pusers-client", verified: true });
    const staff = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pusers-type-staff" });

    await page.goto("/platform/users");
    await page.locator('select[name="type"]').selectOption("staff");
    await page.getByRole("button", { name: /^filtrer$/i }).click();

    await expect(page.getByText(staff.email)).toBeVisible();
    await expect(page.getByText(client.email)).toHaveCount(0);
  });

  test("Filtre type=client : n'affiche que les clients", async ({ page }) => {
    const client = await createTestUser({ scope: "pusers-client2", verified: true });
    const staff = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pusers-type2-staff" });

    await page.goto("/platform/users");
    await page.locator('select[name="type"]').selectOption("client");
    await page.getByRole("button", { name: /^filtrer$/i }).click();

    await expect(page.getByText(client.email)).toBeVisible();
    await expect(page.getByText(staff.email)).toHaveCount(0);
  });

  test("Case 'Archivés' : bascule entre actifs et archives", async ({ page }) => {
    const actif = await createTestUser({ scope: "pusers-actif", verified: true });
    const archive = await createTestUser({ scope: "pusers-archive", verified: true });
    await getDb().user.update({ where: { id: archive.id }, data: { archived: true } });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pusers-archived-staff" });

    await page.goto("/platform/users");
    await expect(page.getByText(actif.email)).toBeVisible();
    await expect(page.getByText(archive.email)).toHaveCount(0);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /^filtrer$/i }).click();
    await expect(page.getByText(archive.email)).toBeVisible();
  });

  test("Recherche sans resultat : table vide", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pusers-empty-staff" });

    await page.goto("/platform/users");
    await page.getByPlaceholder(/rechercher un utilisateur/i).fill("zzz-inexistant-e2e");
    await page.getByRole("button", { name: /^filtrer$/i }).click();

    await expect(page.getByText(/aucun utilisateur/i)).toBeVisible();
  });

  // --- Navigation ---------------------------------------------------------

  test("Le clic sur un utilisateur ouvre sa fiche", async ({ page }) => {
    const user = await createTestUser({ scope: "pusers-nav", verified: true });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pusers-nav-staff" });

    await page.goto("/platform/users");
    await page.locator("tr", { hasText: user.email }).getByRole("link").first().click();
    await page.waitForURL(`**/platform/users/${user.id}`);
  });
});
