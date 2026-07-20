import { test, expect } from "@playwright/test";

// Pages diverses — /styleguide
// Le rendu de /register/success vit desormais dans register.spec.ts (page dediee).
test.describe("Public — Divers", () => {
  test("Le styleguide se rend", async ({ page }) => {
    const res = await page.goto("/styleguide");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: /styleguide/i })).toBeVisible();
  });
});
