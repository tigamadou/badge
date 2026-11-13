import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, disconnectDb, getDb } from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { toast } from "../helpers/feedback";

// Page Rôles — /platform/roles
// Garde `platform.roles.manage` : SUPER_ADMIN seulement (rôle système). Les rôles système sont en lecture
// (dupliquer), les rôles personnalisés plateforme se créent, modifient, archivent et restaurent.
const PREFIX = "E2E rôle ";

test.describe("Platform — Rôles", () => {
  test.afterAll(async () => {
    // Les rôles plateforme personnalisés n'ont pas d'organisation : le nettoyage global ne les voit pas.
    await getDb().role.deleteMany({ where: { name: { startsWith: PREFIX }, systemKey: null } });
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("SUPER_ADMIN voit les rôles système ; un STAFF_ADMIN est redirigé", async ({ page }) => {
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "roles-list" });
    await page.goto("/platform/roles");
    await expect(page.getByRole("heading", { name: /^rôles$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Super administrateur" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Observateur" })).toBeVisible();
    await expect(page.getByText("Système").first()).toBeVisible();

    await page.context().clearCookies();
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "roles-admin" });
    await page.goto("/platform/roles");
    await expect(page).toHaveURL(/\/platform$/);
  });

  test("Les onglets Organisation et Évènement listent les rôles système en lecture seule", async ({ page }) => {
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "roles-tabs" });
    await page.goto("/platform/roles?tab=org");
    await expect(page.getByText("Propriétaire")).toBeVisible();
    await expect(page.getByRole("link", { name: /nouveau rôle/i })).toHaveCount(0);
    await page.getByRole("link", { name: "Évènement" }).click();
    await expect(page.getByText("Lecteur")).toBeVisible();
  });

  test("SUPER_ADMIN crée, modifie, archive puis restaure un rôle personnalisé", async ({ page }) => {
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "roles-crud" });
    const name = `${PREFIX}${Date.now()}`;

    await page.goto("/platform/roles/new");
    await page.getByLabel("Nom du rôle").fill(name);
    await page.getByLabel(/Consulter les organisations/).check();
    await page.getByRole("button", { name: /créer le rôle/i }).click();
    await expect(toast(page, /rôle créé/i)).toBeVisible();
    await expect(page).toHaveURL(/\/platform\/roles$/);

    const created = await getDb().role.findFirstOrThrow({ where: { name }, include: { permissions: true } });
    expect(created.scope).toBe("PLATFORM");
    expect(created.permissions.map((p) => p.permission)).toEqual(["organizations.read"]);

    await page.getByRole("link", { name }).click();
    await page.getByLabel(/Créer une organisation/).check();
    await page.getByRole("button", { name: /^enregistrer$/i }).click();
    await expect(toast(page, /rôle enregistré/i)).toBeVisible();
    await expect
      .poll(async () => (await getDb().rolePermission.count({ where: { roleId: created.id } })))
      .toBe(2);

    const row = page.locator("li", { hasText: name });
    await row.getByRole("button", { name: /^archiver$/i }).click();
    await expect(toast(page, /rôle archivé/i)).toBeVisible();
    await expect(row.getByText("Archivé")).toBeVisible();

    await row.getByRole("button", { name: /^restaurer$/i }).click();
    await expect(toast(page, /rôle restauré/i)).toBeVisible();
    expect((await getDb().role.findUniqueOrThrow({ where: { id: created.id } })).archived).toBe(false);
  });

  test("Un nom déjà pris est refusé avec un message clair", async ({ page }) => {
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "roles-dup-name" });
    await page.goto("/platform/roles/new");
    await page.getByLabel("Nom du rôle").fill("Support");
    await page.getByRole("button", { name: /créer le rôle/i }).click();
    await expect(toast(page, /déjà utilisé/i)).toBeVisible();
  });

  test("Dupliquer un rôle système pré-remplit l'éditeur sans les permissions réservées", async ({ page }) => {
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "roles-copy" });
    await page.goto("/platform/roles");
    await page.locator("li", { hasText: "Observateur" }).getByRole("link", { name: /dupliquer/i }).click();
    await expect(page.getByLabel("Nom du rôle")).toHaveValue("Observateur (copie)");
    await expect(page.getByLabel(/Consulter les organisations/)).toBeChecked();
    await expect(page.getByText("platform.roles.manage")).toHaveCount(0);
  });

  test("Un rôle système est affiché en lecture seule", async ({ page }) => {
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "roles-readonly" });
    await page.goto("/platform/roles");
    await page.getByRole("link", { name: "Support" }).first().click();
    await expect(page.getByText(/rôle système/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^enregistrer$/i })).toHaveCount(0);
  });
});
