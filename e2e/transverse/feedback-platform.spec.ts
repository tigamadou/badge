import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestOrgWithOwner, disconnectDb, getDb } from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { toast, countRequests, failWith500Html } from "../helpers/feedback";

// Loader et toast sur les actions de /platform (spec 28).
test.describe("Feedback — /platform", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("double clic sur « Créer » : une seule requête, bouton bloqué jusqu'au changement d'URL", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "fb-orgnew" });
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const posts = countRequests(page, "POST", "/api/platform/organizations");

    await page.goto("/platform/organizations/new");
    await page.getByLabel(/Nom de l'organisation/i).fill(`Feedback E2E ${suffix}`);
    await page.getByLabel(/E-mail du OWNER/i).fill(`e2e-fb-${suffix}@v2-11-e2e.test`);
    const submit = page.getByRole("button", { name: /créer l'organisation/i });
    await submit.dblclick();
    await expect(submit).toBeDisabled();

    await page.waitForURL(/\/platform\/organizations\/(?!new$)[a-z0-9-]+$/i, { timeout: 15_000 });
    expect(posts()).toBe(1);
  });

  test("erreur 500 HTML à l'archivage : toast d'échec, bouton réactivé", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "fb-archive-500" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "fb-archive-500-staff" });
    await failWith500Html(page, "**/api/platform/organizations/*/archive");

    await page.goto(`/platform/organizations/${orgId}`);
    const archive = page.getByRole("button", { name: /^archiver$/i });
    await archive.click();

    await expect(toast(page, "Échec de l'archivage.")).toBeVisible();
    await expect(archive).toBeEnabled();
  });

  test("succès de l'archivage : toast « Organisation archivée. »", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "fb-archive-ok" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "fb-archive-ok-staff" });

    await page.goto(`/platform/organizations/${orgId}`);
    await page.getByRole("button", { name: /^archiver$/i }).click();

    await expect(toast(page, "Organisation archivée.")).toBeVisible();
  });

  test("réponse 500 HTML sur les réglages : toast de repli, sans code ni HTML", async ({ page }) => {
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "fb-settings-500" });
    await failWith500Html(page, "**/api/platform/settings");

    await page.goto("/platform/settings");
    const save = page.getByRole("button", { name: /enregistrer les paramètres/i });
    await save.click();

    const t = toast(page, "Échec de l'enregistrement des paramètres.");
    await expect(t).toBeVisible();
    await expect(t).not.toContainText("<html");
    await expect(save).toBeEnabled();
  });

  test("double clic sur « Archiver » d'un plan : une seule requête PATCH", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "fb-plan-dbl" });
    const planName = `E2E Plan Feedback ${Date.now()}`;
    const plan = await getDb().plan.create({ data: { name: planName, period: "MONTHLY" } });
    const patches = countRequests(page, "PATCH", `/api/platform/plans/${plan.id}`);

    // Liste paginee (10 par defaut) : le plan neuf est classe en fin de catalogue.
    await page.goto("/platform/plans?pageSize=500");
    await page.locator("tr", { hasText: planName }).getByRole("button", { name: "Archiver" }).dblclick();

    await expect(toast(page, "Plan archivé.")).toBeVisible();
    expect(patches()).toBe(1);
    await getDb().plan.delete({ where: { id: plan.id } });
  });

  test("double clic sur « Se déconnecter » : un seul signOut", async ({ page }) => {
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "fb-logout-dbl" });
    await page.goto("/platform");
    const signouts = countRequests(page, "POST", "/api/auth/signout");

    await page.getByRole("button", { name: /^déconnexion$/i }).click();
    await page.getByRole("button", { name: /^se déconnecter$/i }).dblclick();

    // En conteneur la redirection cible un hôte injoignable : on vérifie l'effet (session effacée).
    await expect.poll(signouts).toBe(1);
    await page.goto("/platform");
    await page.waitForURL(/\/login/, { timeout: 8000 });
  });
});
