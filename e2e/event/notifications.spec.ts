import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  disconnectDb,
  makeEventAdminUser,
  type TestEventRole,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";

// Page des notifications — Notifications d'évènement (socle du lot notifications), pour les
// quatre gabarits de rôle.
test.describe("Event — Notifications", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  const roles: TestEventRole[] = ["ADMIN", "OPERATOR", "PRINTER", "VIEWER"];
  for (const role of roles) {
    test(`${role} ouvre Notifications depuis le menu`, async ({ page }) => {
      const scope = `notif-evt-${role.toLowerCase()}`;
      const { orgId, eventId } = await createTestEvent({ scope });
      const user =
        role === "ADMIN"
          ? await makeEventAdminUser({ scope, eventId, orgId })
          : await createTestEventMember({ scope, eventId, orgId, role });
      await loginAndEnter(page, user, { kind: "event", id: eventId });

      await page.locator("#app-shell-nav").getByRole("link", { name: "Notifications" }).click();
      await expect(page).toHaveURL(new RegExp(`/event/${eventId}/notifications$`));
      await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
      await expect(page.getByText("Aucune notification", { exact: true })).toBeVisible();
    });
  }
});
