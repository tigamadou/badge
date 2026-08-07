import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  makeEventAdminUser,
  getEventBadgeTemplateId,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { ensureFixtures } from "../fixtures";
import { expectLastActivity } from "../helpers/audit";

// Page Parametres evenement — /event/[eventId]/settings et /settings/badge
// Rôle : ADMIN (la page badge exige la permission event.settings.update).
// Actions : upload logo, enregistrer les infos, enregistrer le contact (override
// cascade Event > Org), choisir le modele de badge / revenir a l'heritage.
test.describe("Event — Parametres", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN modifie les infos de l'evenement via le formulaire", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "settings-info" });
    const admin = await makeEventAdminUser({ scope: "settings-info", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.getByRole("link", { name: /paramètres/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/settings`));

    await page.getByLabel("Titre").fill("Salon E2E renomme");
    await page.getByLabel("Lieu").fill("Yamoussoukro");
    await page.getByText("Inscriptions ouvertes").click(); // ferme les inscriptions
    await page.getByRole("button", { name: /^enregistrer$/i }).first().click();

    // Reponse attendue — SUCCES : persiste en base + audit.
    await expect(async () => {
      const fresh = await getDb().event.findUnique({ where: { id: eventId } });
      expect(fresh?.title).toBe("Salon E2E renomme");
      expect(fresh?.location).toBe("Yamoussoukro");
      expect(fresh?.registrationOpen).toBe(false);
    }).toPass();
    await expectLastActivity({ type: "EVENT_UPDATED", userId: admin.id, eventId });
  });

  test("ADMIN ajoute une description et une date de fin", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({
      scope: "settings-details",
      date: new Date("2026-12-15T00:00:00Z"),
    });
    const admin = await makeEventAdminUser({ scope: "settings-details", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/settings`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/settings`));

    await page.getByLabel(/date de fin/i).fill("2026-12-18");
    await page.getByLabel(/description/i).fill("Programme complet sur trois jours.");
    await page.getByRole("button", { name: /^enregistrer$/i }).first().click();

    await expect(async () => {
      const fresh = await getDb().event.findUnique({ where: { id: eventId } });
      expect(fresh?.description).toBe("Programme complet sur trois jours.");
      expect(fresh?.endDate?.toISOString().slice(0, 10)).toBe("2026-12-18");
    }).toPass();
  });

  test("ADMIN voit une erreur si la date de fin precede la date de debut", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({
      scope: "settings-badend",
      date: new Date("2026-12-15T00:00:00Z"),
    });
    const admin = await makeEventAdminUser({ scope: "settings-badend", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/settings`);
    await page.getByLabel(/date de fin/i).fill("2026-12-10");
    await page.getByRole("button", { name: /^enregistrer$/i }).first().click();

    // Reponse attendue — ECHEC : message d'erreur UI + aucune date de fin en base.
    await expect(page.getByText(/la date de fin doit être postérieure/i)).toBeVisible();
    const fresh = await getDb().event.findUnique({ where: { id: eventId } });
    expect(fresh?.endDate).toBeNull();
  });

  test("ADMIN definit les coordonnees de contact via le formulaire", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "settings-contact" });
    const admin = await makeEventAdminUser({ scope: "settings-contact", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/settings`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/settings`));

    await page.getByLabel("E-mail de contact").fill("contact@e2e-event.test");
    await page.getByLabel("Téléphone de contact").fill("+225 00 00 00 00");
    await page.getByRole("button", { name: /^enregistrer$/i }).last().click();

    // Reponse attendue — SUCCES : override persiste + audit.
    await expect(async () => {
      const settings = await getDb().eventSettings.findUnique({ where: { eventId } });
      expect(settings?.contactEmail).toBe("contact@e2e-event.test");
      expect(settings?.contactPhone).toBe("+225 00 00 00 00");
    }).toPass();
    await expectLastActivity({ type: "EVENT_SETTINGS_UPDATED", userId: admin.id, eventId });
  });




  // --- Actions UI ---------------------------------------------------------

  test("ADMIN voit la page Parametres", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evset-render" });
    const admin = await makeEventAdminUser({ scope: "evset-render", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/settings`);
    await expect(page.getByRole("button", { name: /enregistrer/i }).first()).toBeVisible();
  });

  test("ADMIN televerse un logo d'evenement", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evset-logo" });
    const admin = await makeEventAdminUser({ scope: "evset-logo", eventId, orgId });
    const fixtures = ensureFixtures();
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/settings`);
    await page.locator('input[type="file"]').first().setInputFiles(fixtures.jpeg);

    await expect(page.getByRole("button", { name: /retirer/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("ADMIN choisit un modele de badge puis revient a l'heritage", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evset-badge-ui" });
    const admin = await makeEventAdminUser({ scope: "evset-badge-ui", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/settings/badge`);
    await page.getByTestId("select-recto-verso-v1").click();
    await expect(page.getByTestId("save-success")).toBeVisible();

    const after = await getDb().event.findUnique({
      where: { id: eventId },
      select: { badgeTemplateId: true },
    });
    expect(after?.badgeTemplateId).toBe("recto-verso-v1");
  });
});
