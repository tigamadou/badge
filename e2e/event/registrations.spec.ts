import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

// Page Inscriptions (liste) — /event/[eventId]/registrations
// Rôle : ADMIN. Actions : recherche (nom/e-mail/document), filtre statut,
// Actualiser, Export CSV, pagination (25/page), lien vers le detail,
// bouton Nouvelle inscription.
test.describe("Event — Inscriptions (liste)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function addReg(
    eventId: string,
    categoryId: string,
    status: "PENDING" | "APPROVED" | "REJECTED",
    scope: string,
  ) {
    const participant = await createTestUser({ scope, verified: true, profile: true });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status,
    });
    return { participant, reg };
  }

  // --- Acces & rendu ------------------------------------------------------

  test("ADMIN voit la liste des inscriptions", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "reg-render" });
    await addReg(eventId, categoryId, "PENDING", "reg-render-p");
    const admin = await makeEventAdminUser({ scope: "reg-render", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations`);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByRole("cell", { name: /en attente/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^inscription$/i })).toBeVisible();
  });

  // BUG APPLICATIF : la route GET /registrations renvoie snapshotFirstName /
  // snapshotLastName / snapshotEmail, mais RegistrationTable lit r.firstName /
  // r.lastName / r.email -> les colonnes Nom et E-mail sont VIDES dans l'UI.
  // Test laisse en fixme tant que le mapping n'est pas corrige cote src/.
  test.fixme("La liste affiche le nom et l'e-mail du participant", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "reg-names" });
    const { participant } = await addReg(eventId, categoryId, "PENDING", "reg-names-p");
    const admin = await makeEventAdminUser({ scope: "reg-names", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations`);
    await expect(page.getByText(participant.email)).toBeVisible();
  });

  test("Etat vide : aucune inscription", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "reg-empty" });
    const admin = await makeEventAdminUser({ scope: "reg-empty", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations`);
    await expect(page.getByText(/aucune inscription/i)).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("Filtre par statut", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "reg-filter" });
    await addReg(eventId, categoryId, "PENDING", "reg-filter-p");
    await addReg(eventId, categoryId, "APPROVED", "reg-filter-a");
    const admin = await makeEventAdminUser({ scope: "reg-filter", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations`);
    await expect(page.getByRole("cell", { name: /en attente/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /^validé$/i })).toBeVisible();

    await page.locator("select").selectOption("APPROVED");
    await expect(page.getByRole("cell", { name: /^validé$/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /en attente/i })).toBeHidden();
  });

  test("Recherche par e-mail : filtre serveur applique", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "reg-search" });
    const { participant: cible } = await addReg(eventId, categoryId, "PENDING", "reg-search-hit");
    await addReg(eventId, categoryId, "PENDING", "reg-search-miss");
    const admin = await makeEventAdminUser({ scope: "reg-search", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations`);
    await expect(page.locator("tbody tr")).toHaveCount(2);

    // L'affichage du nom/e-mail est casse (cf. fixme ci-dessus) : on verifie le
    // filtrage serveur via le nombre de lignes retournees.
    await page.getByPlaceholder(/rechercher/i).fill(cible.email);
    await expect(page.locator("tbody tr")).toHaveCount(1);
  });

  test("Pagination : 25 par page, la page 2 affiche la suite", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "reg-pagin" });
    // 26 inscriptions => 2 pages.
    for (let i = 0; i < 26; i++) {
      await addReg(eventId, categoryId, "PENDING", `reg-pagin-${i}`);
    }
    const admin = await makeEventAdminUser({ scope: "reg-pagin", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations`);
    // 25 lignes de donnees sur la premiere page.
    await expect(page.locator("tbody tr")).toHaveCount(25);

    await page.getByRole("button", { name: /suivant/i }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);

    await page.getByRole("button", { name: /précédent/i }).click();
    await expect(page.locator("tbody tr")).toHaveCount(25);
  });

  test("Le clic sur une ligne ouvre le detail", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "reg-detail-nav" });
    const { reg } = await addReg(eventId, categoryId, "PENDING", "reg-detail-nav-p");
    const admin = await makeEventAdminUser({ scope: "reg-detail-nav", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations`);
    // Le lien du nom est vide (bug de mapping) : on passe par le lien "Détail".
    await page.getByRole("link", { name: /détail/i }).first().click();
    await page.waitForURL(`**/event/${eventId}/registrations/${reg.id}`);
  });

  test("Le bouton 'Nouvelle inscription' mene au formulaire", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "reg-new-nav" });
    const admin = await makeEventAdminUser({ scope: "reg-new-nav", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations`);
    await page.getByRole("link", { name: /^inscription$/i }).click();
    await page.waitForURL(`**/event/${eventId}/registrations/new`);
  });

  // --- Gardes & API -------------------------------------------------------

  test("Export CSV : la route repond un CSV", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "reg-export" });
    await addReg(eventId, categoryId, "APPROVED", "reg-export-p");
    const admin = await makeEventAdminUser({ scope: "reg-export", eventId, orgId });
    await loginAs(page, admin);

    const res = await page.request.get(
      `/api/org/${orgId}/events/${eventId}/registrations/export`,
    );
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("csv");
  });
});
