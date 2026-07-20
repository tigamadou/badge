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

  test("STAFF_ADMIN modifie smtpHost/smtpPort/smtpFrom (audit changedFields, jamais secrets)", async ({ page }) => {
    const admin = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "settings-smtp" });

    const newHost = `smtp.e2e-${Date.now()}.test`;
    const newPort = 2587;
    const newFrom = `noreply-${Date.now()}@v2-11-e2e.test`;

    const res = await page.request.patch("/api/platform/settings", {
      data: { smtpHost: newHost, smtpPort: newPort, smtpFrom: newFrom },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.settings).toBeDefined();
    // Pas de secret dans la reponse.
    expect("smtpPassword" in body.settings).toBe(false);
    expect("recaptchaSecretKey" in body.settings).toBe(false);

    const db = await getDb().platformSettings.findUnique({
      where: { id: "singleton" },
      select: { smtpHost: true, smtpPort: true, smtpFrom: true },
    });
    expect(db?.smtpHost).toBe(newHost);
    expect(db?.smtpPort).toBe(newPort);
    expect(db?.smtpFrom).toBe(newFrom);

    const audit = await expectLastActivity({
      type: "PLATFORM_SETTINGS_UPDATED",
      userId: admin.id,
    });
    const details = audit.details as {
      changedFields?: string[];
      smtpPasswordChanged?: boolean;
      values?: Record<string, unknown>;
    } | null;
    expect(details?.changedFields).toEqual(
      expect.arrayContaining(["smtpHost", "smtpPort", "smtpFrom"]),
    );
    expect(details?.smtpPasswordChanged).toBe(false);
    // Aucune valeur de secret dans l'audit.
    expect(JSON.stringify(details)).not.toContain("smtpPassword:");

    // Ce test pose volontairement un smtpHost/Port bidon (hors mailpit) pour
    // verifier l'audit. On restaure une config SMTP valide (mailpit, seed par
    // defaut) pour ne pas casser les tests suivants qui envoient reellement
    // des mails via ce singleton PlatformSettings partage (voir prisma/seed.ts).
    await getDb().platformSettings.update({
      where: { id: "singleton" },
      data: {
        smtpHost: "mailpit",
        smtpPort: 1025,
        smtpFrom: "noreply@badge.local",
      },
    });
  });

  test("SUPER_ADMIN modifie smtpPassword (audit smtpPasswordChanged=true, valeur non auditee)", async ({ page }) => {
    const admin = await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "settings-secret" });

    const secret = `s3cret-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await page.request.patch("/api/platform/settings", {
      data: { smtpPassword: secret },
    });
    expect(res.status()).toBe(200);

    const audit = await expectLastActivity({
      type: "PLATFORM_SETTINGS_UPDATED",
      userId: admin.id,
    });
    const details = audit.details as {
      smtpPasswordChanged?: boolean;
      values?: Record<string, unknown>;
    } | null;
    expect(details?.smtpPasswordChanged).toBe(true);
    // Verifie que la valeur en clair n'est jamais auditee.
    expect(JSON.stringify(details)).not.toContain(secret);
  });

  test("Test SMTP envoie un mail au staff (POST /api/platform/settings/test-smtp)", async ({ page }) => {
    const admin = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "settings-smtp-test" });
    await mailpit.clear();

    const res = await page.request.post("/api/platform/settings/test-smtp", {
      data: { to: admin.email },
    });
    expect(res.status()).toBe(200);

    await mailpit.expectMail({
      to: admin.email,
      subjectPattern: /test smtp/i,
      timeoutMs: 8000,
    });

    const audit = await expectLastActivity({
      type: "PLATFORM_SETTINGS_UPDATED",
      userId: admin.id,
    });
    const details = audit.details as { action?: string; ok?: boolean } | null;
    expect(details?.action).toBe("test-smtp");
    expect(details?.ok).toBe(true);
  });

  test("Secrets jamais retournes par GET /api/platform/settings", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "settings-get" });

    const res = await page.request.get("/api/platform/settings");
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.settings).toBeDefined();
    // Aucune valeur secrete renvoyee, seulement les indicateurs booleens *Set.
    expect("smtpPassword" in body.settings).toBe(false);
    expect("recaptchaSecretKey" in body.settings).toBe(false);
    expect(typeof body.settings.smtpPasswordSet).toBe("boolean");
    expect(typeof body.settings.recaptchaSecretKeySet).toBe("boolean");
  });

  test("Selection badge template platform (default-v1 OK, template inconnu -> 400 UNKNOWN_TEMPLATE)", async ({ page }) => {
    const admin = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "settings-badge" });

    const ok = await page.request.patch("/api/platform/settings/badge", {
      data: { badgeTemplateId: "default-v1" },
    });
    expect(ok.status()).toBe(200);
    const okBody = await ok.json();
    expect(okBody.badgeTemplateId).toBe("default-v1");

    const dbAfter = await getDb().platformSettings.findUnique({
      where: { id: "singleton" },
      select: { badgeTemplateId: true },
    });
    expect(dbAfter?.badgeTemplateId).toBe("default-v1");

    await expectLastActivity({
      type: "PLATFORM_SETTINGS_UPDATED",
      userId: admin.id,
    });

    const ko = await page.request.patch("/api/platform/settings/badge", {
      data: { badgeTemplateId: "ghost-template" },
    });
    expect(ko.status()).toBe(400);
    const koBody = await ko.json();
    expect(koBody.error).toBe("UNKNOWN_TEMPLATE");
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

  test("STAFF_ADMIN -> 403 FORBIDDEN_SECRET_CHANGE sur un secret", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pset-secret-403" });

    const res = await page.request.patch("/api/platform/settings", {
      data: { smtpPassword: "tentative" },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toBe("FORBIDDEN_SECRET_CHANGE");
  });

  test("Moins que STAFF_ADMIN est redirige hors de /settings/badge", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "pset-badge-obs" });

    await page.goto("/platform/settings/badge");
    await expect(page).not.toHaveURL(/\/platform\/settings\/badge$/);
  });
});
