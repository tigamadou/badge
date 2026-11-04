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
import { toast } from "../helpers/feedback";
import { confirmCrop, installFramedTemplate } from "../helpers/images-2a";

// Page Parametres evenement — /event/[eventId]/settings et /settings/badge
// Rôle : ADMIN (la page badge exige la permission event.settings.update).
// Actions : upload logo, enregistrer les infos, enregistrer le contact (override
// cascade Event > Org), choisir le modele de badge / revenir a l'heritage.
// Template installe minimal, avec ou sans option, pointe par l'evenement. Le
// prefixe de famille `e2e-` le rend aussi nettoyable par cleanupE2ETestData.
async function installE2ETemplate(opts: { adminId: string; eventId: string; withOption: boolean }) {
  const layout = {
    formatVersion: 3,
    family: "e2e-options",
    label: "Options E2E",
    description: "",
    category: "badge",
    page: { widthPx: 320, heightPx: 460, count: 1 },
    variables: opts.withOption
      ? [{ name: "showColorBar", kind: "boolean", label: "Bandeau tricolore", sample: true }]
      : [],
    blocks: [
      {
        type: "text", page: 1, x: 10, y: 10, w: 200, h: 30,
        text: "BANDEAU",
        style: { sizePx: 14, color: "#000000", overflow: "clip" },
        ...(opts.withOption ? { visibleIf: { variable: "showColorBar", equals: true } } : {}),
      },
    ],
  };
  const row = await getDb().installedBadgeTemplate.create({
    data: {
      family: `e2e-options-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, version: 1,
      label: "Options E2E", description: "",
      pages: 1, pageWidthPx: 320, pageHeightPx: 460, layout,
      bindings: opts.withOption ? { showColorBar: "option" } : {},
      assetPrefix: "badge-templates/e2e-options/", formatVersion: 3, installedById: opts.adminId,
    },
  });
  await getDb().event.update({ where: { id: opts.eventId }, data: { badgeTemplateId: row.id } });
  return row;
}

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

  test("ADMIN televerse un logo conforme au cadre : aucun cadrage", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evset-logo" });
    const admin = await makeEventAdminUser({ scope: "evset-logo", eventId, orgId });
    const row = await installFramedTemplate({ adminId: admin.id, eventId, logo: { w: 68, h: 68 } });
    const fixtures = ensureFixtures();
    try {
      await loginAndEnter(page, admin, { kind: "event", id: eventId });

      await page.goto(`/event/${eventId}/settings`);
      await page.locator('input[type="file"]').first().setInputFiles(fixtures.square);

      await expect(page.getByRole("button", { name: /retirer/i }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole("button", { name: "Valider le cadrage" })).toHaveCount(0);
      await page.getByRole("button", { name: /^enregistrer$/i }).first().click();
      await expect(async () => {
        const fresh = await getDb().event.findUniqueOrThrow({ where: { id: eventId } });
        expect(fresh.logoWidth).toBe(600);
        expect(fresh.logoHeight).toBe(600);
      }).toPass();
    } finally {
      await row.cleanup();
    }
  });

  test("ADMIN televerse un logo hors cadre : le cadrage s'ouvre et le logo enregistre est au bon ratio", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evset-logo-crop" });
    const admin = await makeEventAdminUser({ scope: "evset-logo-crop", eventId, orgId });
    const row = await installFramedTemplate({ adminId: admin.id, eventId, logo: { w: 68, h: 68 } });
    const fixtures = ensureFixtures();
    try {
      await loginAndEnter(page, admin, { kind: "event", id: eventId });

      await page.goto(`/event/${eventId}/settings`);
      // Le format attendu est lisible avant tout envoi.
      await expect(page.getByText(/1:1/).first()).toBeVisible();
      await page.locator('input[type="file"]').first().setInputFiles(fixtures.wide);
      await confirmCrop(page);
      await expect(page.getByRole("button", { name: /retirer/i }).first()).toBeVisible({
        timeout: 15_000,
      });

      await page.getByRole("button", { name: /^enregistrer$/i }).first().click();
      await expect(async () => {
        const fresh = await getDb().event.findUniqueOrThrow({ where: { id: eventId } });
        expect(fresh.logo).toBeTruthy();
        expect(Math.abs(fresh.logoWidth! / fresh.logoHeight! - 1)).toBeLessThan(0.02);
        expect(fresh.logoOriginal).toBeTruthy();
        expect(fresh.logoOriginal).not.toBe(fresh.logo);
      }).toPass();
    } finally {
      await row.cleanup();
    }
  });

  test("ADMIN choisit un modele de badge puis revient a l'heritage", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evset-badge-ui" });
    const admin = await makeEventAdminUser({ scope: "evset-badge-ui", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    // Les modeles installes ont un id cuid : on retrouve celui de la famille recto-verso.
    const installed = await getDb().installedBadgeTemplate.findFirstOrThrow({
      where: { family: "recto-verso" },
      orderBy: { version: "desc" },
      select: { id: true },
    });

    await page.goto(`/event/${eventId}/settings/badge`);
    await page.getByTestId(`select-${installed.id}`).click();
    await expect(toast(page, "Template enregistré.")).toBeVisible();

    const after = await getDb().event.findUnique({
      where: { id: eventId },
      select: { badgeTemplateId: true },
    });
    expect(after?.badgeTemplateId).toBe(installed.id);
  });
  test("ADMIN regle les options du badge du template de l'evenement", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evset-options" });
    const admin = await makeEventAdminUser({ scope: "evset-options", eventId, orgId });
    const row = await installE2ETemplate({ adminId: admin.id, eventId, withOption: true });
    try {
      await loginAndEnter(page, admin, { kind: "event", id: eventId });

      await page.goto(`/event/${eventId}/settings`);
      await expect(page.getByText("Options du badge")).toBeVisible();
      const checkbox = page.getByLabel("Bandeau tricolore");
      await expect(checkbox).toBeChecked();

      await checkbox.uncheck();
      await page.getByRole("button", { name: /^enregistrer$/i }).first().click();
      await expect(async () => {
        const fresh = await getDb().event.findUnique({ where: { id: eventId } });
        expect(fresh?.templateOptions).toEqual({ showColorBar: false });
      }).toPass();

      await page.reload();
      await expect(page.getByLabel("Bandeau tricolore")).not.toBeChecked();
    } finally {
      await getDb().event.update({ where: { id: eventId }, data: { badgeTemplateId: null } });
      await getDb().installedBadgeTemplate.delete({ where: { id: row.id } });
    }
  });

  test("le bloc Options du badge est absent sans option de template", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evset-nooptions" });
    const admin = await makeEventAdminUser({ scope: "evset-nooptions", eventId, orgId });
    const row = await installE2ETemplate({ adminId: admin.id, eventId, withOption: false });
    try {
      await loginAndEnter(page, admin, { kind: "event", id: eventId });

      await page.goto(`/event/${eventId}/settings`);
      await expect(page.getByRole("button", { name: /enregistrer/i }).first()).toBeVisible();
      await expect(page.getByText("Options du badge")).toHaveCount(0);
    } finally {
      await getDb().event.update({ where: { id: eventId }, data: { badgeTemplateId: null } });
      await getDb().installedBadgeTemplate.delete({ where: { id: row.id } });
    }
  });

  test("ADMIN televerse une banniere, elle persiste apres rechargement", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evset-banner" });
    const admin = await makeEventAdminUser({ scope: "evset-banner", eventId, orgId });
    const fixtures = ensureFixtures();
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/settings`);
    await expect(page.getByText("Déposer une bannière ou cliquer")).toBeVisible();
    // Le logo precede la banniere dans la page : on cible la zone de la banniere.
    await page
      .getByText("Déposer une bannière ou cliquer")
      .locator("xpath=ancestor::div[.//input[@type='file']][1]")
      .locator('input[type="file"]')
      .setInputFiles(fixtures.jpeg);
    await expect(page.getByText("Bannière de l'événement")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /^enregistrer$/i }).first().click();
    await expect(async () => {
      const fresh = await getDb().event.findUnique({ where: { id: eventId } });
      expect(fresh?.banner).toBeTruthy();
    }).toPass();

    await page.reload();
    await expect(page.getByText("Bannière de l'événement")).toBeVisible();
  });
});
