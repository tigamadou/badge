import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestStaff, disconnectDb } from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";

// Page des notifications — Notifications (socle du lot notifications) : atteinte par le menu du gabarit.
test.describe("Platform — Notifications", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("le staff ouvre Notifications depuis le menu", async ({ page }) => {
    const staff = await createTestStaff({ role: "STAFF_OBSERVER", scope: "notif-notifications" });
    await loginAndEnter(page, staff, { kind: "platform" });

    await page.locator("#app-shell-nav").getByRole("link", { name: "Notifications" }).click();
    await expect(page).toHaveURL(/\/platform\/notifications$/);
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText("Aucune notification", { exact: true })).toBeVisible();
  });
});
