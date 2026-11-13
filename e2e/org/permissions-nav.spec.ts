import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestOrgMember, createTestOrgWithOwner, disconnectDb } from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";

// Menu et gardes de l'espace organisation, par permission (table ORG_NAV, spec 37).
test.describe("Org — Menu et gardes par permission", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  const nav = (page: import("@playwright/test").Page, name: string) =>
    page.locator("aside, nav").getByRole("link", { name: new RegExp(`^${name}`) });

  test("MANAGER : Événements et Membres, ni Rôles ni Paramètres", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "orgnav-mgr" });
    const manager = await createTestOrgMember({ scope: "orgnav-mgr", orgId, role: "MANAGER" });
    await loginAndEnter(page, manager, { kind: "org", id: orgId });
    await expect(nav(page, "Événements").first()).toBeVisible();
    await expect(nav(page, "Membres").first()).toBeVisible();
    await expect(nav(page, "Rôles")).toHaveCount(0);
    await expect(nav(page, "Paramètres")).toHaveCount(0);
  });

  test("AUDITOR : consultation, ni Abonnement ni Paiements", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "orgnav-aud" });
    const auditor = await createTestOrgMember({ scope: "orgnav-aud", orgId, role: "AUDITOR" });
    await loginAndEnter(page, auditor, { kind: "org", id: orgId });
    await expect(nav(page, "Journal").first()).toBeVisible();
    await expect(nav(page, "Abonnement")).toHaveCount(0);
    await expect(nav(page, "Paiements")).toHaveCount(0);
  });

  test("AGENT : Événements seulement ; une page interdite le renvoie au tableau de bord", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "orgnav-agent" });
    const agent = await createTestOrgMember({ scope: "orgnav-agent", orgId, role: "AGENT" });
    await loginAndEnter(page, agent, { kind: "org", id: orgId });
    await expect(nav(page, "Événements").first()).toBeVisible();
    for (const hidden of ["Membres", "Rôles", "Abonnement", "Paiements", "Paramètres", "Journal"]) {
      await expect(nav(page, hidden)).toHaveCount(0);
    }
    await page.goto(`/org/${orgId}/settings`);
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}$`));
  });
});
