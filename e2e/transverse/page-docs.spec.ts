import { test, expect, type Page } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestOrgMember,
  createTestOrgWithOwner,
  createTestUser,
  disconnectDb,
} from "../helpers/db";
import { loginAs, loginAsStaff } from "../helpers/auth";

const HELP = "Aide sur cette page";
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("Documentation des pages", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("OWNER : le bouton « ? » ouvre le panneau, Échap le ferme et le focus revient au bouton", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pd-owner" });
    await loginAs(page, owner);
    await page.goto(`/org/${orgId}/members`);

    const button = page.getByRole("button", { name: HELP });
    await expect(button).toBeVisible();
    await button.click();
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Membres" })).toBeVisible();
    await expect(panel.getByText("Mise à jour le")).toBeVisible();
    await expect(panel.getByText("Inviter un membre").first()).toBeVisible();
    await expect(panel.getByRole("link", { name: "Toute la documentation" })).toHaveAttribute("href", `/org/${orgId}/docs`);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("AUDITOR : le bloc réservé à org.members.manage est absent du panneau", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pd-auditor" });
    const auditor = await createTestOrgMember({ scope: "pd-auditor", orgId, role: "AUDITOR" });
    await loginAs(page, auditor);
    await page.goto(`/org/${orgId}/members`);

    await page.getByRole("button", { name: HELP }).click();
    const panel = page.getByRole("dialog");
    await expect(panel.getByRole("heading", { name: "Membres" })).toBeVisible();
    await expect(panel.getByText("Le tableau")).toBeVisible();
    await expect(panel.getByText("Inviter un membre")).toHaveCount(0);
    await expect(panel.getByText("Retirer")).toHaveCount(0);
  });

  test("page sans doc : pas de bouton ; la section Documentation liste et lit les docs ; doc inexistante : 404", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pd-list" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/docs`);
    await expect(page.getByRole("heading", { name: "Documentation", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: HELP })).toHaveCount(0);

    await page.locator(`a[href="/org/${orgId}/docs/members"]`).click();
    await page.waitForURL(`**/org/${orgId}/docs/members`);
    await expect(page.getByRole("heading", { name: "Membres", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documentation" }).first()).toBeVisible();

    const res = await page.goto(`/org/${orgId}/docs/inexistante`);
    expect(res?.status()).toBe(404);
  });

  test("plateforme, évènement et compte : la section Documentation répond 200", async ({ page }) => {
    const staffPage = page;
    await loginAsStaff(staffPage, { role: "STAFF_OBSERVER", scope: "pd-platform" });
    const platform = await staffPage.goto("/platform/docs");
    expect(platform?.status()).toBe(200);
    await expect(staffPage.getByRole("heading", { name: "Documentation", level: 1 })).toBeVisible();
    await expect(staffPage.locator("main a[href^='/platform/docs/']").first()).toBeVisible();
    expect((await staffPage.goto("/platform/docs/inexistante"))?.status()).toBe(404);

    const { orgId, eventId } = await createTestEvent({ scope: "pd-event" });
    const member = await createTestEventMember({ scope: "pd-event", eventId, orgId, role: "VIEWER" });
    await staffPage.context().clearCookies();
    await loginAs(staffPage, member);
    const event = await staffPage.goto(`/event/${eventId}/docs`);
    expect(event?.status()).toBe(200);
    await expect(staffPage.getByRole("heading", { name: "Documentation", level: 1 })).toBeVisible();

    const user = await createTestUser({ scope: "pd-account", verified: true });
    await staffPage.context().clearCookies();
    await loginAs(staffPage, user);
    const account = await staffPage.goto("/account/docs");
    expect(account?.status()).toBe(200);
    await expect(staffPage.getByRole("heading", { name: "Documentation", level: 1 })).toBeVisible();
  });

  for (const [width, height] of [
    [375, 812],
    [1024, 768],
    [1280, 800],
  ] as const) {
    test(`mise en page du panneau à ${width} px`, async ({ page }) => {
      const { orgId, owner } = await createTestOrgWithOwner({ scope: `pd-vp-${width}` });
      await page.setViewportSize({ width, height });
      await loginAs(page, owner);
      await page.goto(`/org/${orgId}/members`);
      await page.getByRole("button", { name: HELP }).click();
      const panel = page.getByRole("dialog");
      await expect(panel.getByRole("heading", { name: "Membres" })).toBeVisible();
      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      if (width === 375) {
        expect(Math.round(box!.width)).toBe(375);
        expect(Math.round(box!.height)).toBe(height);
      } else {
        expect(box!.width).toBeLessThan(width);
        expect(Math.round(box!.x + box!.width)).toBe(width);
      }
      expect(await noHorizontalScroll(page)).toBe(true);
    });
  }
});
