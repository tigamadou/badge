import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestUser, disconnectDb } from "../helpers/db";
import { loginAs } from "../helpers/auth";

// Page des notifications — Notifications du participant (socle du lot notifications).
test.describe("Compte — Notifications", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("le participant ouvre Notifications depuis l'en-tête", async ({ page }) => {
    const user = await createTestUser({ scope: "acc-notif", verified: true, profile: true });
    await loginAs(page, user);
    await expect(page).toHaveURL(/\/account/);

    await page.getByRole("link", { name: "Notifications" }).click();
    await expect(page).toHaveURL(/\/account\/notifications$/);
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText("Aucune notification", { exact: true })).toBeVisible();
  });
});
