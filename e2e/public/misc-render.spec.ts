import { test, expect } from "@playwright/test";

// Rendu (smoke) de pages publiques diverses sans authentification.

test.describe("Pages publiques diverses (rendu)", () => {
  test("GET /register/success affiche la confirmation d'inscription", async ({ page }) => {
    const res = await page.goto("/register/success");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByText(/inscription envoyée/i)).toBeVisible();
  });

  test("GET /styleguide se rend (design system)", async ({ page }) => {
    const res = await page.goto("/styleguide");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: /styleguide/i })).toBeVisible();
  });
});
