import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

// Page Espace compte — /account
// Authentifiee. Tableau de bord du participant : liste de ses inscriptions avec
// leur statut, lien vers le detail, invitation a completer son profil.
test.describe("Compte — Tableau de bord", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("Le participant voit son nom et ses inscriptions", async ({ page }) => {
    const { eventId, categoryId } = await createTestEvent({ scope: "acc-render" });
    const user = await createTestUser({ scope: "acc-render-u", verified: true, profile: true });
    await createTestRegistration({ eventId, userId: user.id, categoryId, status: "PENDING" });
    await loginAs(page, user);

    await page.goto("/account");
    await expect(page.getByRole("heading", { name: new RegExp(user.name, "i") })).toBeVisible();
    await expect(page.getByText(/en attente/i).first()).toBeVisible();
  });

  test("Etat vide : aucune inscription", async ({ page }) => {
    const user = await createTestUser({ scope: "acc-empty", verified: true, profile: true });
    await loginAs(page, user);

    await page.goto("/account");
    await expect(page.getByText(/aucune inscription/i)).toBeVisible();
  });

  test("Non connecte -> redirige vers /login", async ({ page }) => {
    await page.goto("/account");
    await page.waitForURL(/\/login/);
  });

  // --- Statuts ------------------------------------------------------------

  test("Une inscription approuvee est affichee comme validee", async ({ page }) => {
    const { eventId, categoryId } = await createTestEvent({ scope: "acc-approved" });
    const user = await createTestUser({ scope: "acc-approved-u", verified: true, profile: true });
    await createTestRegistration({ eventId, userId: user.id, categoryId, status: "APPROVED" });
    await loginAs(page, user);

    await page.goto("/account");
    await expect(page.getByText(/^validé$/i).first()).toBeVisible();
  });

  test("Une inscription rejetee est affichee comme telle", async ({ page }) => {
    const { eventId, categoryId } = await createTestEvent({ scope: "acc-rejected" });
    const user = await createTestUser({ scope: "acc-rejected-u", verified: true, profile: true });
    await createTestRegistration({ eventId, userId: user.id, categoryId, status: "REJECTED" });
    await loginAs(page, user);

    await page.goto("/account");
    await expect(page.getByText(/^rejeté$/i).first()).toBeVisible();
  });

  // --- Navigation ---------------------------------------------------------

  test("Le clic sur une inscription ouvre son detail", async ({ page }) => {
    const { eventId, categoryId } = await createTestEvent({ scope: "acc-nav" });
    const user = await createTestUser({ scope: "acc-nav-u", verified: true, profile: true });
    const reg = await createTestRegistration({
      eventId,
      userId: user.id,
      categoryId,
      status: "PENDING",
    });
    await loginAs(page, user);

    await page.goto("/account");
    // Le lien enveloppe toute la ligne : on le cible par le titre de l'evenement.
    await page.getByRole("link", { name: /Salon E2E/i }).first().click();
    await page.waitForURL(`**/account/registrations/${reg.id}`);
  });

  // --- Securite -----------------------------------------------------------

  test("Le nom d'utilisateur est echappe (pas d'injection HTML)", async ({ page }) => {
    const xssPayload = "<script>window.__xssTriggered=true</script>Awa";
    const user = await createTestUser({ scope: "acc-xss", verified: true });
    await getDb().user.update({ where: { id: user.id }, data: { name: xssPayload } });
    await loginAs(page, user);

    await page.goto("/account");
    // Le script ne doit pas s'executer : le nom est rendu comme du texte.
    expect(await page.evaluate(() => (window as { __xssTriggered?: boolean }).__xssTriggered)).toBeUndefined();
  });
});
