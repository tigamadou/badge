import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  disconnectDb,
} from "../helpers/db";
import { loginAs, loginAsStaff } from "../helpers/auth";

// Acces a l'espace plateforme — gates du layout /platform
// Residu transverse apres la reorganisation par page : entree dans l'espace et
// matrice de roles non rattachee a une page precise. Les negatifs propres a une
// page vivent dans sa spec (creation org, users, settings, plans...).
test.describe("Platform — Acces a l'espace", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Gates du layout ----------------------------------------------------

  test("Non connecte -> redirige vers /login", async ({ page }) => {
    await page.goto("/platform");
    await page.waitForURL(/\/login/);
  });

  test("Utilisateur non-staff -> redirige vers l'accueil", async ({ page }) => {
    const { owner } = await createTestOrgWithOwner({ scope: "pacc-nonstaff" });
    await loginAs(page, owner);

    await page.goto("/platform");
    await expect(page).not.toHaveURL(/\/platform/);
  });


  test("Le plancher d'acces est STAFF_OBSERVER", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "pacc-observer" });

    await page.goto("/platform");
    await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible();
  });

  test("La nav plateforme expose les sections principales", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pacc-nav" });

    await page.goto("/platform");
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: /organisations/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /plans/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /utilisateurs/i })).toBeVisible();
  });

  test("Le shell de supervision d'une org expose ses onglets", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pacc-shell" });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "pacc-shell-staff" });

    await page.goto(`/platform/organizations/${orgId}`);
    await expect(page.getByRole("link", { name: /événements/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /membres/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /abonnement/i }).first()).toBeVisible();
  });
});
