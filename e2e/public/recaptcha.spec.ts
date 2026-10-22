import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestEvent, createTestUser, getDb, disconnectDb } from "../helpers/db";
import { loginAs } from "../helpers/auth";

// reCAPTCHA v3 sur l'inscription et le mot de passe oublie. Google est simule : le script est
// remplace par un stub qui renvoie un jeton reconnaissable, et le test verifie ce que le
// navigateur envoie au serveur. Le serveur, lui, interroge la vraie API de verification avec
// un faux secret : il refuse, ce qui prouve que la verification est bien declenchee.
const SCRIPT_URL = "https://www.google.com/recaptcha/api.js*";
const STUB = `window.grecaptcha = {
  ready: (cb) => cb(),
  execute: (key, opts) => Promise.resolve("e2e-token:" + key + ":" + opts.action),
};`;
const REFUSED = /vérification recaptcha refusée/i;

test.describe("Public — reCAPTCHA v3", () => {
  // Un seul reglage global (PlatformSettings) : les tests ne peuvent pas se chevaucher.
  test.describe.configure({ mode: "serial" });

  let original: { recaptchaEnabled: boolean; recaptchaSiteKey: string; recaptchaSecretKey: string };

  async function setRecaptcha(enabled: boolean) {
    await getDb().platformSettings.update({
      where: { id: "singleton" },
      data: { recaptchaEnabled: enabled, recaptchaSiteKey: "e2e-site-key", recaptchaSecretKey: "e2e-secret" },
    });
  }

  test.beforeAll(async () => {
    original = await getDb().platformSettings.findUniqueOrThrow({
      where: { id: "singleton" },
      select: { recaptchaEnabled: true, recaptchaSiteKey: true, recaptchaSecretKey: true },
    });
    await setRecaptcha(true);
  });

  test.afterAll(async () => {
    await getDb().platformSettings.update({ where: { id: "singleton" }, data: original });
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // Les routes limitent le debit par IP (5 demandes par minute pour le mot de passe oublie) et
  // lisent x-forwarded-for : une IP de test distincte par test evite de partager le compteur
  // avec password-reset.spec.ts ou avec une relance rapprochee.
  test.beforeEach(async ({ page }) => {
    await page.context().setExtraHTTPHeaders({
      "x-forwarded-for": `203.0.113.${1 + Math.floor(Math.random() * 250)}`,
    });
  });

  test("mot de passe oublie : le jeton de l'action est envoye au serveur", async ({ page }) => {
    await page.route(SCRIPT_URL, (route) => route.fulfill({ contentType: "application/javascript", body: STUB }));

    await page.goto("/forgot-password");
    await page.getByLabel(/adresse e-mail/i).fill("recaptcha-forgot@e2e.test");
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/auth/forgot-password") && r.method() === "POST"),
      page.getByRole("button", { name: /envoyer le lien/i }).click(),
    ]);

    expect(request.postDataJSON().recaptchaToken).toBe("e2e-token:e2e-site-key:forgot_password");
    await expect(page.getByText(REFUSED)).toBeVisible();
  });

  test("inscription : le jeton de l'action est envoye au serveur", async ({ page }) => {
    await page.route(SCRIPT_URL, (route) => route.fulfill({ contentType: "application/javascript", body: STUB }));

    await page.goto("/register");
    await page.getByLabel("Nom complet").fill("Recaptcha E2E");
    await page.getByLabel("Email").fill("recaptcha-register@e2e.test");
    await page.getByLabel(/^mot de passe/i).fill("Secret123!");
    await page.getByLabel(/confirmer/i).fill("Secret123!");
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/auth/register") && r.method() === "POST"),
      page.getByRole("button", { name: /créer mon compte/i }).click(),
    ]);

    expect(request.postDataJSON().recaptchaToken).toBe("e2e-token:e2e-site-key:register");
    await expect(page.getByText(REFUSED)).toBeVisible();
  });

  test("definition du mot de passe : le jeton de l'action est envoye au serveur", async ({ page }) => {
    await page.route(SCRIPT_URL, (route) => route.fulfill({ contentType: "application/javascript", body: STUB }));
    // Le flux compare l'invitation en clair (cf. setup-password.spec.ts).
    const user = await createTestUser({ scope: "recaptcha-setup", verified: false });
    const invite = `e2e-invite-recaptcha-${Date.now()}`;
    await getDb().user.update({
      where: { id: user.id },
      data: { inviteToken: invite, inviteTokenExpiry: new Date(Date.now() + 3600_000) },
    });

    await page.goto(`/setup-password?token=${encodeURIComponent(invite)}`);
    await page.getByLabel("Nouveau mot de passe").fill("InvitePass1234!");
    await page.getByLabel("Confirmer le mot de passe").fill("InvitePass1234!");
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/auth/setup-password") && r.method() === "POST"),
      page.getByRole("button", { name: /activer mon compte/i }).click(),
    ]);

    expect(request.postDataJSON().recaptchaToken).toBe("e2e-token:e2e-site-key:setup_password");
    await expect(page.getByText(REFUSED)).toBeVisible();
    // Refuse : le compte n'a pas change et l'invitation reste utilisable.
    const reloaded = await getDb().user.findUniqueOrThrow({ where: { id: user.id } });
    expect(reloaded.inviteToken).toBe(invite);
  });

  test("reinitialisation du mot de passe : le jeton de l'action est envoye au serveur", async ({ page }) => {
    await page.route(SCRIPT_URL, (route) => route.fulfill({ contentType: "application/javascript", body: STUB }));

    // Le lien n'a pas besoin d'etre valide : la verification precede la consultation du lien.
    await page.goto("/reset-password/e2e-lien-reset");
    await page.getByLabel("Nouveau mot de passe").fill("NewPass1234!");
    await page.getByLabel("Confirmer le mot de passe").fill("NewPass1234!");
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/auth/reset-password") && r.method() === "POST"),
      page.getByRole("button", { name: /mettre à jour/i }).click(),
    ]);

    expect(request.postDataJSON().recaptchaToken).toBe("e2e-token:e2e-site-key:reset_password");
    await expect(page.getByText(REFUSED)).toBeVisible();
  });

  test("inscription a un evenement : le jeton de l'action est envoye au serveur", async ({ page }) => {
    await page.route(SCRIPT_URL, (route) => route.fulfill({ contentType: "application/javascript", body: STUB }));
    const user = await createTestUser({ scope: "recaptcha-evt", verified: true, profile: true });
    const { eventSlug } = await createTestEvent({ scope: "recaptcha-evt" });
    await loginAs(page, user);

    await page.goto(`/e/${eventSlug}/register`);
    await page.getByRole("radio", { name: /visiteur/i }).check();
    await page.getByRole("checkbox").last().check();
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes(`/api/events/${eventSlug}/register`) && r.method() === "POST"),
      page.getByRole("button", { name: /s'inscrire/i }).click(),
    ]);

    expect(request.postDataJSON().recaptchaToken).toBe("e2e-token:e2e-site-key:event_register");
    await expect(page.getByText(REFUSED)).toBeVisible();
  });

  test("script Google bloque : message clair et aucune requete envoyee au serveur", async ({ page }) => {
    await page.route(SCRIPT_URL, (route) => route.abort());
    let apiCalled = false;
    page.on("request", (r) => {
      if (r.url().includes("/api/auth/forgot-password")) apiCalled = true;
    });

    await page.goto("/forgot-password");
    await page.getByLabel(/adresse e-mail/i).fill("recaptcha-blocked@e2e.test");
    await page.getByRole("button", { name: /envoyer le lien/i }).click();

    await expect(page.getByText(/vérification anti-spam n'a pas pu démarrer/i)).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test("reCAPTCHA desactive : aucun script charge et aucun jeton envoye", async ({ page }) => {
    await setRecaptcha(false);
    let scriptRequested = false;
    await page.route(SCRIPT_URL, (route) => {
      scriptRequested = true;
      return route.abort();
    });

    await page.goto("/forgot-password");
    await page.getByLabel(/adresse e-mail/i).fill("recaptcha-off@e2e.test");
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/auth/forgot-password") && r.method() === "POST"),
      page.getByRole("button", { name: /envoyer le lien/i }).click(),
    ]);

    expect(scriptRequested).toBe(false);
    expect(request.postDataJSON()).not.toHaveProperty("recaptchaToken");
    // Le serveur accepte la requete : un jeton a null serait refuse (INVALID_BODY).
    await expect(page.getByText(/un lien de réinitialisation a été envoyé/i)).toBeVisible();
    await setRecaptcha(true);
  });
});
