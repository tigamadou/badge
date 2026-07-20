import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";
import { ensureFixtures } from "../fixtures";

// Page Inscription manuelle — /event/[eventId]/registrations/new
// Rôle : ADMIN. Le POST resout le participant par e-mail : le profil doit exister
// et etre complet (les champs texte du formulaire sont ignores au profit du snapshot).
// Actions : formulaire de creation, uploads photo et document.
test.describe("Event — Inscription manuelle", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("ADMIN voit le formulaire d'inscription manuelle", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "regnew-render" });
    const admin = await makeEventAdminUser({ scope: "regnew-render", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/new`);
    await expect(page.getByRole("heading", { name: /inscription manuelle/i })).toBeVisible();
    await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("ADMIN cree une inscription via le formulaire", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "regnew-create" });
    const admin = await makeEventAdminUser({ scope: "regnew-create", eventId, orgId });
    const participant = await createTestUser({
      scope: "regnew-create-part",
      verified: true,
      profile: true,
    });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/new`);
    await page.getByLabel("Prénom").fill("Ignoré");
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Ignoré");
    await page.getByLabel("Adresse e-mail").fill(participant.email);
    await page.getByLabel("Structure / organisation").fill("Structure UI");
    await page.getByLabel("Numéro de pièce").fill("UI-DOC-001");
    await page.getByRole("button", { name: /créer l'inscription/i }).click();

    // Redirection vers le detail. Le lookahead evite de matcher l'URL de depart /new.
    await page.waitForURL(new RegExp(`/event/${eventId}/registrations/(?!new$)[A-Za-z0-9-]+$`), {
      timeout: 8000,
    });

    const regId = page.url().split("/registrations/")[1];
    const created = await getDb().registration.findUnique({ where: { id: regId } });
    expect(created?.eventId).toBe(eventId);
    expect(created?.snapshotEmail).toBe(participant.email);

    await expectLastActivity({
      type: "REGISTRATION_CREATED",
      userId: admin.id,
      eventId,
      targetId: created!.id,
    });
  });

  test("ADMIN televerse une photo depuis le formulaire", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "regnew-photo" });
    const admin = await makeEventAdminUser({ scope: "regnew-photo", eventId, orgId });
    const fixtures = ensureFixtures();
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/new`);
    await page.locator('input[type="file"][accept*="image"]').first().setInputFiles(fixtures.jpeg);

    // L'upload aboutit : un apercu / bouton de retrait apparait.
    await expect(page.getByRole("button", { name: /retirer/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("ADMIN televerse un document PDF depuis le formulaire", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "regnew-doc" });
    const admin = await makeEventAdminUser({ scope: "regnew-doc", eventId, orgId });
    const fixtures = ensureFixtures();
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/new`);
    await page.locator('input[type="file"][accept*="pdf"]').first().setInputFiles(fixtures.pdf);

    await expect(page.getByRole("button", { name: /retirer/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  // --- Gardes & API -------------------------------------------------------

  test("E-mail inconnu -> creation refusee (404)", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "regnew-unknown" });
    const admin = await makeEventAdminUser({ scope: "regnew-unknown", eventId, orgId });
    await loginAs(page, admin);

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/registrations`,
      { data: { email: `inconnu-${Date.now()}@v2-11-e2e.test`, categoryId } },
    );
    // L'utilisateur cible n'existe pas : la route repond 404 (et non 400).
    expect(res.status()).toBe(404);
  });

  test("OPERATOR ne peut pas creer d'inscription -> 403", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "regnew-operator" });
    const operator = await createTestEventMember({
      scope: "regnew-operator-user",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    const participant = await createTestUser({
      scope: "regnew-operator-part",
      verified: true,
      profile: true,
    });
    await loginAs(page, operator);

    const res = await page.request.post(
      `/api/org/${orgId}/events/${eventId}/registrations`,
      { data: { email: participant.email, categoryId } },
    );
    expect(res.status()).toBe(403);
  });
});
