import { test, expect } from "@playwright/test";

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
