import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestInstalledTemplate,
  disconnectDb,
  getDb,
  readOnsiteSettings,
  writeOnsiteSettings,
  type TestOnsiteSettings,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity } from "../helpers/audit";
import { toast } from "../helpers/feedback";

// Page Parametres plateforme — /platform/settings, en onglets pilotes par ?tab=
// (email, security, subscriptions, reasons, badge). /platform/settings/badge redirige
// vers l'onglet badge, masque sous STAFF_ADMIN.
// Rôle : STAFF_ADMIN. Les SECRETS (smtpPassword, recaptchaSecretKey) sont
// reserves au SUPER_ADMIN (403 FORBIDDEN_SECRET_CHANGE sinon) et ne sont JAMAIS
// renvoyes par l'API. La page badge exige STAFF_ADMIN (redirection sinon).
test.describe("Platform — Parametres", () => {
  // Ces specs mutent un etat GLOBAL partage (PlatformSettings). Sans restauration,
  // elles cassent l'envoi de mails des autres specs (ex. TLS active vers Mailpit).
  let snapshot: Record<string, unknown> | null = null;
  // Les reglages « impression sur place » contiennent un JSON nullable que la restauration ci-dessous
  // ne sait pas reecrire : ils ont leur propre sauvegarde.
  let onsiteSnapshot: TestOnsiteSettings | null = null;

  test.beforeAll(async () => {
    const current = await getDb().platformSettings.findFirst();
    snapshot = current ? { ...current } : null;
    onsiteSnapshot = await readOnsiteSettings();
  });

  test.afterAll(async () => {
    if (onsiteSnapshot) await writeOnsiteSettings(onsiteSnapshot);
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

    await page.goto("/platform/settings?tab=security");
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
    // L'onglet Badge est masque : la page retombe sur le premier onglet.
    await expect(page.getByRole("link", { name: "Badge", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Utilisateur SMTP")).toBeVisible();
  });

  test("STAFF_OBSERVER lit E-mails, Securite, Abonnements et Motifs en lecture seule", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "pset-readonly" });

    await page.goto("/platform/settings");
    const tabs = page.getByRole("navigation", { name: "Sections des paramètres" });
    for (const name of ["E-mails", "Sécurité", "Abonnements", "Motifs de rejet"]) {
      await expect(tabs.getByRole("link", { name })).toBeVisible();
    }
    await expect(tabs.getByRole("link", { name: "Badge", exact: true })).toHaveCount(0);
    await expect(tabs.getByRole("link", { name: "Impression sur place" })).toHaveCount(0);

    // E-mails : champs désactivés, ni enregistrement ni test SMTP.
    await expect(page.getByLabel("Utilisateur SMTP")).toBeDisabled();
    await expect(page.getByRole("button", { name: /enregistrer les paramètres/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /envoyer/i })).toHaveCount(0);

    await page.goto("/platform/settings?tab=security");
    await expect(page.getByRole("button", { name: /enregistrer les paramètres/i })).toHaveCount(0);

    await page.goto("/platform/settings?tab=subscriptions");
    await expect(page.getByRole("button", { name: /^enregistrer$/i })).toHaveCount(0);

    await page.goto("/platform/settings?tab=reasons");
    await expect(page.getByRole("button", { name: /^ajouter$/i })).toHaveCount(0);
  });

  test("Un Imprimeur en URL directe sur /settings est renvoye au tableau de bord", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_PRINTER", scope: "pset-printer" });

    await page.goto("/platform/settings");
    await expect(page).toHaveURL(/\/platform$/);
  });

  test("Les onglets changent de section et l'URL suit", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pset-tabs" });

    await page.goto("/platform/settings");
    const tabs = page.getByRole("navigation", { name: "Sections des paramètres" });
    await expect(tabs.getByRole("link", { name: "E-mails" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("Site key")).toHaveCount(0);

    await tabs.getByRole("link", { name: "Sécurité" }).click();
    await expect(page).toHaveURL(/\?tab=security$/);
    await expect(page.getByLabel("Site key")).toBeVisible();
    await expect(page.getByLabel("Utilisateur SMTP")).toHaveCount(0);

    await tabs.getByRole("link", { name: "Abonnements" }).click();
    await expect(page.getByText("Droits selon l'abonnement")).toBeVisible();

    await tabs.getByRole("link", { name: "Badge" }).click();
    await expect(page).toHaveURL(/\?tab=badge$/);
    await expect(page.getByText("Template de badge par défaut")).toBeVisible();
  });

  test("STAFF_ADMIN ajoute puis archive un motif de rejet", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pset-reasons" });
    const label = `E2E motif ${Date.now()}`;

    await page.goto("/platform/settings?tab=reasons");
    await page.getByLabel("Libellé").fill(label);
    await page.getByRole("button", { name: /^ajouter$/i }).click();

    await expect(page.getByRole("cell", { name: label })).toBeVisible();
    await expect(async () => {
      const stored = await getDb().rejectionReason.findFirst({ where: { label } });
      expect(stored).not.toBeNull();
    }).toPass();

    // Archivage : confirmation dans une modale, puis la ligne disparait mais existe toujours en base.
    await page
      .getByRole("row", { name: new RegExp(label) })
      .getByRole("button", { name: /archiver/i })
      .click();
    await expect(page.getByRole("heading", { name: "Archiver le motif" })).toBeVisible();
    // La modale est rendue apres le tableau : son bouton est le dernier « Archiver ».
    await page.getByRole("button", { name: "Archiver", exact: true }).last().click();
    await expect(page.getByRole("cell", { name: label })).toHaveCount(0);
    await expect(async () => {
      const stored = await getDb().rejectionReason.findFirst({ where: { label } });
      expect(stored?.archived).toBe(true);
    }).toPass();
  });

  test("STAFF_ADMIN modifie la portee d'un motif sans le recreer", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pset-reasons-edit" });
    const label = `E2E motif edit ${Date.now()}`;

    await page.goto("/platform/settings?tab=reasons");
    await page.getByLabel("Libellé").fill(label);
    await page.getByRole("button", { name: /^ajouter$/i }).click();
    await expect(page.getByRole("cell", { name: label })).toBeVisible();

    await page
      .getByRole("row", { name: new RegExp(label) })
      .getByRole("button", { name: "Modifier" })
      .click();
    await expect(page.getByRole("heading", { name: "Modifier le motif" })).toBeVisible();
    // Deux listes « Portée » (creation et modale) : la modale est rendue en dernier.
    await page.getByRole("combobox", { name: "Portée" }).last().selectOption("BOTH");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

    await expect(async () => {
      const stored = await getDb().rejectionReason.findFirst({ where: { label } });
      expect(stored?.scope).toBe("BOTH");
    }).toPass();
    await expect(page.getByRole("row", { name: new RegExp(label) })).toContainText("Les deux");
  });

  test("STAFF_SUPPORT ne voit pas le formulaire de motifs", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "pset-reasons-obs" });
    await page.goto("/platform/settings?tab=reasons");
    await expect(page.getByText(/catalogue partagé par la validation/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^ajouter$/i })).toHaveCount(0);
  });

  // --- Onglet « Impression sur place » (plan 35) ----------------------------

  test("STAFF_ADMIN coche un template, règle la marge à 15 % et enregistre", async ({ page }) => {
    const admin = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pset-onsite" });
    const label = `Badge E2E sur place ${Date.now()}`;
    const template = await createTestInstalledTemplate({ installedById: admin.id, label });

    await page.goto("/platform/settings");
    await expect(page).toHaveURL(/\/platform\/settings$/);
    const tabs = page.getByRole("navigation", { name: "Sections des paramètres" });
    await tabs.getByRole("link", { name: "Impression sur place" }).click();
    await expect(page).toHaveURL(/\?tab=onsite-print$/);
    await expect(page.getByText("Templates proposés")).toBeVisible();

    const checkbox = page.getByRole("checkbox", { name: new RegExp(label) });
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await page.getByLabel("Imprimante (note)").fill("Zebra E2E, cartes CR80");
    await page.getByLabel("Marge par défaut (%)").fill("15");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

    // Succès : message affiché, puis la base reflète le choix.
    await expect(toast(page, "Réglages enregistrés.")).toBeVisible();
    await expect(async () => {
      const settings = await readOnsiteSettings();
      expect(settings.onsitePrintTemplateIds).toContain(template.id);
      expect(settings.onsiteDefaultMarginPercent).toBe(15);
      expect(settings.onsitePrinterNote).toBe("Zebra E2E, cartes CR80");
    }).toPass();

    // Après rechargement, la case reste cochée.
    await page.reload();
    await expect(page.getByRole("checkbox", { name: new RegExp(label) })).toBeChecked();
  });

  test("Une marge hors 0-100 est refusée dans le formulaire et rien n'est enregistré", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pset-onsite-margin" });
    await writeOnsiteSettings({ onsiteDefaultMarginPercent: 10 });

    await page.goto("/platform/settings?tab=onsite-print");
    await expect(page).toHaveURL(/\?tab=onsite-print$/);
    await page.getByLabel("Marge par défaut (%)").fill("101");

    // Échec attendu : message d'erreur, bouton désactivé, base inchangée.
    await expect(page.getByText("Saisir un entier entre 0 et 100.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toBeDisabled();
    expect((await readOnsiteSettings()).onsiteDefaultMarginPercent).toBe(10);
  });

  test("STAFF_SUPPORT ne voit pas l'onglet « Impression sur place »", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "pset-onsite-support" });

    await page.goto("/platform/settings");
    await expect(page).toHaveURL(/\/platform\/settings$/);
    const tabs = page.getByRole("navigation", { name: "Sections des paramètres" });
    await expect(tabs.getByRole("link", { name: "E-mails" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Impression sur place" })).toHaveCount(0);

    // Accès direct à l'onglet : retour sur le premier onglet, sans le formulaire.
    await page.goto("/platform/settings?tab=onsite-print");
    await expect(page.getByLabel("Utilisateur SMTP")).toBeVisible();
    await expect(page.getByText("Templates proposés")).toHaveCount(0);
  });
});
