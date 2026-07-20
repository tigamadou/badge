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

  // --- Gardes & API -------------------------------------------------------

  test("Limite d'evenements du plan atteinte -> 409 EVENT_LIMIT", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "ev-limit", maxEvents: 1 });
    await mkEvent(orgId, "Event unique");
    await loginAs(page, owner);

    const res = await page.request.post(`/api/org/${orgId}/events`, {
      data: {
        title: "Event de trop",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        location: "Abidjan",
        categories: [],
      },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).code).toBe("EVENT_LIMIT");
  });

  test("Abonnement inactif -> creation refusee", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "ev-inactive",
      activeSubscription: false,
    });
    await loginAs(page, owner);

    const res = await page.request.post(`/api/org/${orgId}/events`, {
      data: {
        title: "Event sans abonnement",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        location: "Abidjan",
        categories: [],
      },
    });
    expect(res.status()).toBe(403);
  });

  test("Slug deja pris -> 409 SLUG_TAKEN", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "ev-slug" });
    const existing = await mkEvent(orgId, "Event slug source");
    await loginAs(page, owner);

    const res = await page.request.post(`/api/org/${orgId}/events`, {
      data: {
        title: "Autre event",
        slug: existing.slug,
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        location: "Abidjan",
        categories: [],
      },
    });
    expect(res.status()).toBe(409);
    // Cette route renvoie le code dans `error` (et non `code`).
    expect((await res.json()).error).toBe("SLUG_TAKEN");
  });

  test("Payload invalide -> 400", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "ev-400" });
    await loginAs(page, owner);

    const res = await page.request.post(`/api/org/${orgId}/events`, {
      data: { title: "", location: "", categories: [] },
    });
    expect(res.status()).toBe(400);
  });

  test("AUDITOR POST /events -> 403 (le wizard reste atteignable)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "ev-aud" });
    const auditor = await createTestOrgMember({ scope: "ev-aud-user", orgId, role: "AUDITOR" });
    await loginAs(page, auditor);

    // La page /events/new n'a pas de garde : elle s'affiche.
    await page.goto(`/org/${orgId}/events/new`);
    await expect(page.getByLabel("Titre")).toBeVisible();

    // Mais la creation est refusee.
    const res = await page.request.post(`/api/org/${orgId}/events`, {
      data: {
        title: "Tentative AUDITOR",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        location: "Abidjan",
        categories: [],
      },
    });
    expect(res.status()).toBe(403);
  });

  test("AUDITOR GET /api/org/[orgId]/events -> 200 (lecture autorisee)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "ev-aud-read" });
    const auditor = await createTestOrgMember({
      scope: "ev-aud-read-user",
      orgId,
      role: "AUDITOR",
    });
    await loginAs(page, auditor);

    const res = await page.request.get(`/api/org/${orgId}/events`);
    expect(res.status()).toBe(200);
  });

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
});
