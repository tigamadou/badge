import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  makeEventAdminUser,
  getEventBadgeTemplateId,
  disconnectDb,
} from "../helpers/db";

test.describe("v2-12 selection template badge (event-admin)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("admin can pick recto-verso-v1 and clear back to inherit", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "badge-tpl" });
    const admin = await makeEventAdminUser({
      scope: "badge-tpl",
      eventId,
      orgId,
    });

    // Login
    await page.goto("/login");
    await page.getByLabel("Email").fill(admin.email);
    await page.getByLabel("Mot de passe").fill(admin.password);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8000 });

    // Va sur la page de selection de template
    await page.goto(`/admin/${orgId}/events/${eventId}/settings/badge`);
    await expect(page.getByRole("heading", { name: /template de badge/i })).toBeVisible();

    // Au depart : carte default-v1 et recto-verso-v1 affichees, aucune selectionnee
    await expect(page.getByTestId("template-card-default-v1")).toBeVisible();
    await expect(page.getByTestId("template-card-recto-verso-v1")).toBeVisible();

    // Selectionne recto-verso-v1
    await page.getByTestId("select-recto-verso-v1").click();
    await expect(page.getByTestId("save-success")).toBeVisible();

    // Verifie la persistence en BDD
    const persisted = await getEventBadgeTemplateId(eventId);
    expect(persisted).toBe("recto-verso-v1");

    // Reload : la carte recto-verso-v1 doit etre data-selected=true
    await page.reload();
    await expect(
      page.getByTestId("template-card-recto-verso-v1"),
    ).toHaveAttribute("data-selected", "true");

    // Clear (heritage)
    await page.getByRole("button", { name: /utiliser le defaut herite/i }).click();
    await expect(page.getByTestId("save-success")).toBeVisible();
    const afterClear = await getEventBadgeTemplateId(eventId);
    expect(afterClear).toBeNull();
  });
});
