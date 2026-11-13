import { test, expect, type Page } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestOrgMember,
  disconnectDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";

// Menu, atterrissage et gardes de l'espace évènement, par permission (table EVENT_NAV, spec 37).
test.describe("Event — Menu et gardes par permission", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  const nav = (page: Page, name: string) => page.locator("aside, nav").getByRole("link", { name: new RegExp(`^${name}`) });

  test("PRINTER atterrit sur Badges : ni Inscriptions ni Paramètres", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evnav-printer" });
    const printer = await createTestEventMember({ scope: "evnav-printer", orgId, eventId, role: "PRINTER" });
    await loginAndEnter(page, printer, { kind: "event", id: eventId });
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges$`));
    await expect(nav(page, "Badges").first()).toBeVisible();
    await expect(nav(page, "Inscriptions")).toHaveCount(0);
    await expect(nav(page, "Paramètres")).toHaveCount(0);
  });

  test("VIEWER : Vue d'ensemble sans Inscriptions ni « Dernières inscriptions »", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evnav-viewer" });
    const viewer = await createTestEventMember({ scope: "evnav-viewer", orgId, eventId, role: "VIEWER" });
    await loginAndEnter(page, viewer, { kind: "event", id: eventId });
    await expect(nav(page, "Vue d'ensemble").first()).toBeVisible();
    await expect(nav(page, "Inscriptions")).toHaveCount(0);
    await expect(page.getByText("Dernières inscriptions")).toHaveCount(0);
  });

  test("OPERATOR : Scanner, Journal et « Mes scans », sans Paramètres", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evnav-operator" });
    const operator = await createTestEventMember({ scope: "evnav-operator", orgId, eventId, role: "OPERATOR" });
    await loginAndEnter(page, operator, { kind: "event", id: eventId });
    await expect(page.getByText("Mes scans")).toBeVisible();
    await expect(nav(page, "Scanner").first()).toBeVisible();
    await expect(nav(page, "Journal").first()).toBeVisible();
    await expect(nav(page, "Paramètres")).toHaveCount(0);
    await page.goto(`/event/${eventId}/settings`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}$`));
  });

  test("ADMIN : Paramètres, Membres et Impression visibles", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evnav-admin" });
    const admin = await createTestEventMember({ scope: "evnav-admin", orgId, eventId, role: "ADMIN" });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    for (const label of ["Inscriptions", "Badges", "Paramètres", "Membres", "Journal"]) {
      await expect(nav(page, label).first()).toBeVisible();
    }
  });

  test("AUDITOR d'organisation : la liste nominative des inscriptions renvoie au tableau de bord", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evnav-auditor" });
    const auditor = await createTestOrgMember({ scope: "evnav-auditor", orgId, role: "AUDITOR" });
    await loginAndEnter(page, auditor, { kind: "org", id: orgId });
    await page.goto(`/event/${eventId}/registrations`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}$`));
  });

  test("OPERATOR : la liste des inscriptions n'offre ni Exporter ni ajout", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evnav-op-list" });
    const operator = await createTestEventMember({ scope: "evnav-op-list", orgId, eventId, role: "OPERATOR" });
    await loginAndEnter(page, operator, { kind: "event", id: eventId });
    await nav(page, "Inscriptions").first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations$`));
    await expect(page.getByRole("button", { name: /Exporter/ })).toHaveCount(0);
    await expect(page.locator(`a[href="/event/${eventId}/registrations/new"]`)).toHaveCount(0);
  });
});
