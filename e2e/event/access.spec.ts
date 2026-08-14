import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestOrgMember,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { loginAndEnter } from "../helpers/nav";
import { expectLastActivity } from "../helpers/audit";

// Acces a l'espace evenement — gates du layout /event/[eventId]
// Residu transverse apres la reorganisation par page : entree dans l'espace,
// shell rendu selon le role, heritage des roles org -> event, et comportement
// sur un evenement archive. Les negatifs propres a une page vivent dans sa spec.
test.describe("Event — Acces a l'espace", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function seedApprovedReg(scope: string) {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope });
    const participant = await createTestUser({
      scope: `${scope}-part`,
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "PENDING",
    });
    return { orgId, eventId, categoryId, reg };
  }

  // --- Gates du layout ----------------------------------------------------

  test("Non connecte -> redirige vers /login", async ({ page }) => {
    const { eventId } = await createTestEvent({ scope: "evacc-anon" });

    await page.goto(`/event/${eventId}`);
    await page.waitForURL(/\/login/);
  });

  test("Evenement introuvable -> 404", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evacc-404" });
    const admin = await makeEventAdminUser({ scope: "evacc-404", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    const res = await page.goto("/event/event-inexistant-e2e");
    expect(res?.status()).toBe(404);
  });

  test("Utilisateur sans lien avec l'evenement -> sorti de l'espace", async ({ page }) => {
    const { eventId } = await createTestEvent({ scope: "evacc-outsider" });
    const outsider = await createTestUser({ scope: "evacc-outsider-user", verified: true });
    await loginAs(page, outsider);

    await page.goto(`/event/${eventId}`);
    await expect(page).not.toHaveURL(new RegExp(`/event/${eventId}$`));
  });

  // --- Heritage des roles org -> event ------------------------------------





  // --- Shells par role ----------------------------------------------------

  test("Chaque role obtient son shell dedie", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evacc-shells" });

    const operator = await createTestEventMember({
      scope: "evacc-shell-op",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    await loginAndEnter(page, operator, { kind: "event", id: eventId });
    await page.goto(`/event/${eventId}`);
    await expect(page.getByRole("heading", { name: /tableau de bord opérateur/i })).toBeVisible();

    const printer = await createTestEventMember({
      scope: "evacc-shell-pr",
      orgId,
      eventId,
      role: "PRINTER",
    });
    await loginAndEnter(page, printer, { kind: "event", id: eventId });
    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/impression —/i)).toBeVisible();

    const viewer = await createTestEventMember({
      scope: "evacc-shell-vw",
      orgId,
      eventId,
      role: "VIEWER",
    });
    await loginAndEnter(page, viewer, { kind: "event", id: eventId });
    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/lecture —/i)).toBeVisible();
  });

  // --- Evenement archive --------------------------------------------------

  test("Les pages d'un evenement archive restent consultables", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "evacc-archived" });
    const admin = await makeEventAdminUser({ scope: "evacc-archived", eventId, orgId });
    await getDb().event.update({
      where: { id: eventId },
      data: { archived: true, archivedAt: new Date(), registrationOpen: false },
    });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/tableau de bord de l'événement/i).first()).toBeVisible();

    await page.goto(`/event/${eventId}/registrations`);
    await expect(page.locator("tbody")).toBeVisible();
  });
});
