import { test, expect } from "@playwright/test";
import { cleanupBillingPlans, createTestPlan } from "../helpers/billing";
import { disconnectDb } from "../helpers/db";

// Rendu (smoke) des pages publiques marketing / legales du route group (marketing).
// Ces pages sont statiques et sans authentification : on verifie que chacune se rend
// correctement (titre attendu + chrome partage visible), sans page d'erreur.
const PAGES: Array<{ path: string; titlePattern: RegExp }> = [
  { path: "/", titlePattern: /inscriptions, badges/i },
  { path: "/a-propos", titlePattern: /à propos/i },
  { path: "/fonctionnalites", titlePattern: /fonctionnalités/i },
  { path: "/tarifs", titlePattern: /tarifs/i },
  { path: "/contact", titlePattern: /contact/i },
  { path: "/cgu", titlePattern: /conditions générales/i },
  { path: "/confidentialite", titlePattern: /confidentialité/i },
  { path: "/mentions-legales", titlePattern: /mentions légales/i },
];

test.describe("Pages publiques marketing / legales (rendu)", () => {
  for (const { path, titlePattern } of PAGES) {
    test(`GET ${path} se rend avec le titre attendu et le header public`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(400);
      await expect(page).toHaveTitle(titlePattern);
      // Chrome partage du site public (PublicSiteHeader) : lien "Se connecter" -> /login.
      await expect(page.getByRole("link", { name: /se connecter/i }).first()).toBeVisible();
    });
  }

  // --- Formulaire de contact ----------------------------------------------

  test("Le formulaire de contact refuse une soumission sans consentement", async ({ page }) => {
    await page.goto("/contact");
    await page.getByPlaceholder("vous@organisation.fr").fill("contact-e2e@v2-11-e2e.test");

    // Le bouton reste desactive tant que le consentement n'est pas coche.
    await expect(page.getByRole("button", { name: /envoyer la demande/i })).toBeDisabled();
  });

  test("Le formulaire de contact envoie la demande", async ({ page }) => {
    await page.goto("/contact");
    await page.getByPlaceholder("Camille").fill("Camille");
    await page.getByPlaceholder("Fabre").fill("Fabre");
    await page.getByPlaceholder("vous@organisation.fr").fill("contact-e2e@v2-11-e2e.test");
    await page.getByPlaceholder("Nom de votre organisation").fill("Org E2E");
    await page.getByPlaceholder(/décrivez votre besoin/i).fill("Demande de test E2E.");
    await page.getByRole("checkbox").check();

    await page.getByRole("button", { name: /envoyer la demande/i }).click();

    await expect(page.getByRole("heading", { name: /demande envoyée/i })).toBeVisible();
  });
});

// /tarifs est alimentee par les plans visibles de la base (rendu dynamique). La base est partagee : on ne
// suppose rien sur les autres plans, seulement sur ceux crees ici (l'etat vide est couvert par Vitest).
test.describe("Pages publiques — /tarifs (plans de la base)", () => {
  test.afterAll(async () => {
    await cleanupBillingPlans();
    await disconnectDb();
  });

  test("affiche un plan visible avec prix et fonctionnalites, masque archive et non visible", async ({ page }) => {
    const visible = await createTestPlan({
      scope: "tarifs-visible",
      price: 23456,
      publicVisible: true,
      position: 9000,
      description: "Plan visible e2e",
      features: ["Fonction e2e alpha", "Fonction e2e beta"],
    });
    const hidden = await createTestPlan({ scope: "tarifs-hidden", price: 11000, publicVisible: false, position: 9001 });
    const archived = await createTestPlan({
      scope: "tarifs-archived",
      price: 12000,
      publicVisible: true,
      archived: true,
      position: 9002,
    });

    await page.goto("/tarifs");
    const card = page.locator("div", { has: page.getByText(visible.name, { exact: true }) }).filter({ hasText: "Plan visible e2e" }).last();
    await expect(card).toContainText(/23\s456 FCFA/);
    await expect(card).toContainText("Fonction e2e alpha");
    await expect(card).toContainText("Fonction e2e beta");
    await expect(page.getByText(hidden.name, { exact: true })).toHaveCount(0);
    await expect(page.getByText(archived.name, { exact: true })).toHaveCount(0);
  });

  test("un plan sans prix propose Nous contacter", async ({ page }) => {
    const plan = await createTestPlan({
      scope: "tarifs-quote",
      price: null,
      publicVisible: true,
      position: 9003,
      description: "Plan sur devis e2e",
    });

    await page.goto("/tarifs");
    const card = page.locator("div", { has: page.getByText(plan.name, { exact: true }) }).filter({ hasText: "Plan sur devis e2e" }).last();
    await expect(card).toContainText("Sur devis");
    await expect(card.getByRole("link", { name: "Nous contacter" })).toBeVisible();
  });

  test("la bascule mensuel / annuel filtre les plans payants", async ({ page }) => {
    const monthly = await createTestPlan({ scope: "tarifs-m", price: 5000, period: "MONTHLY", publicVisible: true, position: 9004 });
    const annual = await createTestPlan({ scope: "tarifs-a", price: 50000, period: "ANNUAL", publicVisible: true, position: 9005 });

    await page.goto("/tarifs");
    const group = page.getByRole("group", { name: "Période de facturation" });
    // Les cartes seulement : le tableau comparatif liste tous les plans quelle que soit la periode.
    const cardTitle = (name: string) => page.locator("div.text-base.font-semibold", { hasText: name });
    await expect(group).toBeVisible();
    await group.getByRole("button", { name: "Mensuel" }).click();
    await expect(cardTitle(monthly.name)).toHaveCount(1);
    await expect(cardTitle(annual.name)).toHaveCount(0);
    await group.getByRole("button", { name: "Annuel" }).click();
    await expect(cardTitle(annual.name)).toHaveCount(1);
    await expect(cardTitle(monthly.name)).toHaveCount(0);
  });

  for (const [width, height] of [
    [375, 812],
    [1024, 768],
    [1280, 800],
  ] as const) {
    test(`/tarifs sans debordement horizontal a ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/tarifs");
      await page.waitForLoadState("networkidle");
      const m = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(m.doc).toBeLessThanOrEqual(m.inner);
    });
  }
});
