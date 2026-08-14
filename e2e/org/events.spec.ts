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
import { loginAndEnter } from "../helpers/nav";
import { expectLastActivity } from "../helpers/audit";

// Page Evenements — /org/[orgId]/events (liste) et /org/[orgId]/events/new (wizard)
// Liste : AUDITOR (aucune garde de page). Creation : MANAGER cote API — un AUDITOR
// atteint le wizard mais son POST est refuse.
// Archive/restore sont declenches par API depuis cette zone (pas de bouton dans la liste).
test.describe("Org — Evenements", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function mkEvent(orgId: string, title: string, archived = false) {
    return getDb().event.create({
      data: {
        orgId,
        title,
        slug: `e2e-ev-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        location: "Abidjan",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        archived,
      },
    });
  }

  // Remplit le wizard (3 etapes, categories manuelles vides) et soumet.
  // NB : le slug est auto-suggere et unique -> le cas SLUG_TAKEN n'est pas
  // provocable par l'UI, il reste couvert en integration Vitest.
  async function submitWizard(
    page: import("@playwright/test").Page,
    orgId: string,
    title: string,
  ) {
    await page.goto(`/org/${orgId}/events/new`);
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/events/new`));
    await page.getByLabel("Titre").fill(title);
    const futureIso = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    await page.locator('input[type="date"]').fill(futureIso);
    await page.getByLabel("Lieu").fill("Abidjan");
    await page.getByRole("button", { name: /^continuer$/i }).click();
    await page.getByRole("button", { name: /^continuer$/i }).click();
    await page.getByRole("button", { name: /cr[ée]er l'?[ée]v[ée]nement/i }).click();
  }

  // --- Acces & rendu ------------------------------------------------------

  test("OWNER voit la liste des evenements", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "ev-render" });
    await mkEvent(orgId, "Event Liste E2E");
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/events`);
    await expect(page.getByRole("heading", { name: /événements/i }).first()).toBeVisible();
    await expect(page.getByText("Event Liste E2E")).toBeVisible();
    await expect(page.getByRole("link", { name: /créer un événement/i })).toBeVisible();
  });

  test("Etat vide : aucun evenement", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "ev-empty" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/events`);
    await expect(page.getByText(/aucun événement/i)).toBeVisible();
  });

  test("Un evenement archive est marque comme tel", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "ev-archived-tag" });
    await mkEvent(orgId, "Event Archive E2E", true);
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/events`);
    await expect(page.getByText("Archivé").first()).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("OWNER cree un evenement via le wizard 3 etapes (import de modeles)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "ev-create" });
    await createTestCategoryTemplate({ orgId, name: "VIP", color: "#ff0000", number: 10 });
    await createTestCategoryTemplate({ orgId, name: "Standard", color: "#00ff00", number: 11 });
    await loginAs(page, owner);

    // Etape 1 : titre + date + lieu (le slug est suggere automatiquement).
    await page.goto(`/org/${orgId}/events/new`);
    await page.getByLabel("Titre").fill("E2E Event Wizard");
    const futureIso = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    await page.locator('input[type="date"]').fill(futureIso);
    await page.getByLabel("Lieu").fill("Abidjan");
    await page.getByRole("button", { name: /^continuer$/i }).click();

    // Etape 2 : import des 2 modeles (l'UI ne melange pas modeles et saisie manuelle).
    await page.getByRole("button", { name: /depuis un mod[èe]le/i }).click();
    await page.locator(`label:has-text("VIP")`).locator('[role="checkbox"]').check();
    await page.locator(`label:has-text("Standard")`).locator('[role="checkbox"]').check();
    await page.getByRole("button", { name: /^continuer$/i }).click();

    // Etape 3 : recap puis creation -> redirection vers les parametres de l'event.
    await expect(page.getByText(/r[ée]cap/i)).toBeVisible();
    await page.getByRole("button", { name: /cr[ée]er l'?[ée]v[ée]nement/i }).click();
    await page.waitForURL(new RegExp(`/event/[^/]+/settings`), { timeout: 8000 });

    const event = await getDb().event.findFirst({
      where: { orgId, title: "E2E Event Wizard" },
      select: { id: true, registrationOpen: true, categories: true },
    });
    expect(event?.registrationOpen).toBe(false);
    expect(event?.categories.length).toBe(2);

    await expectLastActivity({
      type: "EVENT_CREATED",
      userId: owner.id,
      orgId,
      eventId: event?.id,
    });
  });

  test("Le bouton 'Créer un événement' mene au wizard", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "ev-link-new" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/events`);
    await page.getByRole("link", { name: /créer un événement/i }).click();
    await page.waitForURL(`**/org/${orgId}/events/new`);
  });

  // --- Actions UI (suite) -------------------------------------------------

  test("OWNER archive puis restaure un evenement via les boutons", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "ev-archive" });
    const event = await mkEvent(orgId, "Event a archiver");
    // Mono-espace : la redirection post-login mene directement a l'org.
    await loginAndEnter(page, owner, { kind: "org", id: orgId });

    await page.getByRole("link", { name: /événements/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/events`));

    const row = page.locator("tr").filter({ hasText: "Event a archiver" });
    page.on("dialog", (d) => d.accept()); // confirm("Archiver cet événement ?")
    await row.getByRole("button", { name: /^archiver$/i }).click();

    // Reponse attendue — SUCCES : le tag "Archivé" apparait dans la ligne.
    await expect(row.getByText("Archivé")).toBeVisible();
    let after = await getDb().event.findUnique({
      where: { id: event.id },
      select: { archived: true, archivedAt: true, registrationOpen: true },
    });
    expect(after?.archived).toBe(true);
    expect(after?.archivedAt).not.toBeNull();
    expect(after?.registrationOpen).toBe(false);
    await expectLastActivity({ type: "EVENT_ARCHIVED", orgId, eventId: event.id, userId: owner.id });

    // Restauration via le bouton de la meme ligne.
    await row.getByRole("button", { name: /^restaurer$/i }).click();
    await expect(row.getByText("Archivé")).toHaveCount(0);
    after = await getDb().event.findUnique({
      where: { id: event.id },
      select: { archived: true, archivedAt: true, registrationOpen: true },
    });
    expect(after?.archived).toBe(false);
    await expectLastActivity({ type: "EVENT_RESTORED", orgId, eventId: event.id, userId: owner.id });
  });
  // --- Echecs metier via l'UI --------------------------------------------

  test("Limite du plan atteinte : le wizard affiche l'erreur", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "ev-limit", maxEvents: 1 });
    await mkEvent(orgId, "Event unique");
    await loginAndEnter(page, owner, { kind: "org", id: orgId });

    await submitWizard(page, orgId, "Event de trop");

    // Reponse attendue — ECHEC : message affiche, aucun event supplementaire.
    await expect(page.getByText(/limite d.[ée]v[ée]nements/i)).toBeVisible();
    expect(await getDb().event.count({ where: { orgId } })).toBe(1);
  });

  test("Abonnement inactif : l'espace org est bloque (pas de wizard)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "ev-inactive",
      activeSubscription: false,
    });
    await loginAndEnter(page, owner, { kind: "org", id: orgId });

    // Sans abonnement actif, l'espace est bloque : le wizard n'est pas atteignable.
    await page.goto(`/org/${orgId}/events/new`);
    await expect(page.getByText(/abonnement (inactif|n.est pas actif)/i)).toBeVisible();
    await expect(page.getByLabel("Titre")).toHaveCount(0);
    expect(await getDb().event.count({ where: { orgId } })).toBe(0);
  });

  
  test("AUDITOR atteint le wizard mais la creation echoue", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "ev-aud" });
    const auditor = await createTestOrgMember({ scope: "ev-aud-user", orgId, role: "AUDITOR" });
    await loginAndEnter(page, auditor, { kind: "org", id: orgId });

    // La page /events/new n'a pas de garde : elle s'affiche.
    await submitWizard(page, orgId, "Event interdit");

    // Reponse attendue — ECHEC : rien n'est cree.
    expect(await getDb().event.count({ where: { orgId } })).toBe(0);
  });
});
