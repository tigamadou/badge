import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, disconnectDb, getDb } from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity } from "../helpers/audit";

// Page Parametres plateforme — /platform/settings et /platform/settings/badge
// Rôle : STAFF_ADMIN. Les SECRETS (smtpPassword, recaptchaSecretKey) sont
// reserves au SUPER_ADMIN (403 FORBIDDEN_SECRET_CHANGE sinon) et ne sont JAMAIS
// renvoyes par l'API. La page badge exige STAFF_ADMIN (redirection sinon).
test.describe("Platform — Parametres", () => {
  // Ces specs mutent un etat GLOBAL partage (PlatformSettings). Sans restauration,
  // elles cassent l'envoi de mails des autres specs (ex. TLS active vers Mailpit).
  let snapshot: Record<string, unknown> | null = null;

  test.beforeAll(async () => {
    const current = await getDb().platformSettings.findFirst();
    snapshot = current ? { ...current } : null;
  });

  test.afterAll(async () => {
    if (snapshot) {
      const { id, ...data } = snapshot as { id: string } & Record<string, unknown>;
      await getDb()
        .platformSettings.update({ where: { id }, data })
        .catch(() => undefined);
    }
    await cleanupE2ETestData();
    await disconnectDb();
  });



  test("Test SMTP : le bouton envoie un e-mail de test (UI)", async ({ page }) => {
    const admin = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "settings-smtp-test" });
    await mailpit.clear();

    await page.goto("/platform/settings");
    await expect(page).toHaveURL(/\/platform\/settings$/);
    await page.getByPlaceholder("moi@example.com").fill(admin.email);
    await page.getByRole("button", { name: /envoyer un e-mail de test/i }).click();

    // Reponse attendue — SUCCES : le mail de test arrive + audit test-smtp.
    await mailpit.expectMail({ to: admin.email, subjectPattern: /test smtp/i, timeoutMs: 8000 });
    const audit = await expectLastActivity({ type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id });
    expect((audit.details as { action?: string } | null)?.action).toBe("test-smtp");
  });



  // --- Actions UI ---------------------------------------------------------

  test("STAFF_ADMIN modifie l'utilisateur SMTP via le formulaire", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pset-ui-smtp" });

    await page.goto("/platform/settings");
    const nouveau = `smtp-user-${Date.now()}`;
    await page.getByLabel("Utilisateur SMTP").fill(nouveau);
    await page.getByRole("button", { name: /enregistrer/i }).first().click();

    await expect(async () => {
      const settings = await getDb().platformSettings.findFirst();
      expect(settings?.smtpUser).toBe(nouveau);
    }).toPass();
  });

  test("STAFF_ADMIN bascule le TLS et l'affichage des secrets", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pset-ui-toggles" });

    await page.goto("/platform/settings");
    const before = (await getDb().platformSettings.findFirst())?.smtpSecure ?? false;

    await page.getByRole("switch", { name: /TLS \(connexion sécurisée\)/i }).click();
    // Le toggle d'affichage des secrets est purement local (aucune persistance).
    await page.getByRole("switch", { name: /afficher les valeurs masquées/i }).click();
    await page.getByRole("button", { name: /enregistrer/i }).first().click();

    await expect(async () => {
      const settings = await getDb().platformSettings.findFirst();
      expect(settings?.smtpSecure).toBe(!before);
    }).toPass();
  });

  test("STAFF_ADMIN configure le reCAPTCHA (activation + site key)", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pset-ui-recaptcha" });

    await page.goto("/platform/settings");
    const siteKey = `site-key-${Date.now()}`;
    await page.getByLabel("Site key").fill(siteKey);
    await page.getByRole("switch", { name: /activé par défaut/i }).click();
    await page.getByRole("button", { name: /enregistrer/i }).first().click();

    await expect(async () => {
      const settings = await getDb().platformSettings.findFirst();
      expect(settings?.recaptchaSiteKey).toBe(siteKey);
    }).toPass();
  });


  test("Moins que STAFF_ADMIN est redirige hors de /settings/badge", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "pset-badge-obs" });

    await page.goto("/platform/settings/badge");
    await expect(page).not.toHaveURL(/\/platform\/settings\/badge$/);
  });

  test("STAFF_ADMIN ajoute puis archive un motif de rejet", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pset-reasons" });
    const label = `E2E motif ${Date.now()}`;

    await page.goto("/platform/settings");
    await page.getByLabel("Libellé").fill(label);
    await page.getByRole("button", { name: /^ajouter$/i }).click();

    await expect(page.getByRole("cell", { name: label })).toBeVisible();
    await expect(async () => {
      const stored = await getDb().rejectionReason.findFirst({ where: { label } });
      expect(stored).not.toBeNull();
    }).toPass();

    // Archivage : la ligne disparait mais la ligne existe toujours en base.
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("row", { name: new RegExp(label) })
      .getByRole("button", { name: /archiver/i })
      .click();
    await expect(page.getByRole("cell", { name: label })).toHaveCount(0);
    await expect(async () => {
      const stored = await getDb().rejectionReason.findFirst({ where: { label } });
      expect(stored?.archived).toBe(true);
    }).toPass();
  });

  test("STAFF_SUPPORT ne voit pas le formulaire de motifs", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "pset-reasons-obs" });
    await page.goto("/platform/settings");
    await expect(page.getByText(/motifs de rejet/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^ajouter$/i })).toHaveCount(0);
  });
});
