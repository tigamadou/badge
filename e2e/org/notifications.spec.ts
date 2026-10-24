import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgMember,
  createTestOrgWithOwner,
  disconnectDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";

// Page des notifications — Notifications d'organisation (socle du lot notifications).
test.describe("Org — Notifications", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("un AUDITOR ouvre Notifications depuis le menu", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "notif-org" });
    const auditor = await createTestOrgMember({ scope: "notif-org-aud", orgId, role: "AUDITOR" });
    await loginAndEnter(page, auditor, { kind: "org", id: orgId });

    await page.locator("#app-shell-nav").getByRole("link", { name: "Notifications" }).click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/notifications$`));
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText("Aucune notification", { exact: true })).toBeVisible();
  });
});
