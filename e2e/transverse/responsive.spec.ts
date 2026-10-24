import { test, expect, type Page } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestCategory,
  createTestEvent,
  createTestRegistration,
  createTestStaff,
  createTestUser,
  disconnectDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { loginAndEnter } from "../helpers/nav";

// Parcours transverse en viewport mobile (375x812) : tiroir de navigation, absence de
// debordement horizontal sur quelques pages de chaque espace, deconnexion depuis le tiroir.
// Voir docs/v4/plans/2026-10-22-responsive-mobile.md (Task 10).

const VIEWPORT = { width: 375, height: 812 };

// Laisse le temps au contenu (liste, tableaux) de se rendre avant de mesurer.
async function expectNoHorizontalOverflow(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(path.replace(/[/]/g, "\\/").replace(/\?.*$/, "")));
  await expect(page.locator("main, body").first()).toBeVisible();
  await page.waitForLoadState("networkidle");

  const m = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      doc: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      main: main ? { scroll: main.scrollWidth, client: main.clientWidth } : null,
    };
  });
  expect(m.doc, `${path} : débordement horizontal du document`).toBeLessThanOrEqual(m.inner);
  if (m.main) {
    expect(m.main.scroll, `${path} : débordement horizontal de <main>`).toBeLessThanOrEqual(
      m.main.client,
    );
  }
}

test.describe("Responsive mobile (transverse)", () => {
  test.use({ viewport: VIEWPORT, isMobile: true, hasTouch: true });

  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Tiroir de navigation -------------------------------------------------

  test("Staff : le tiroir s'ouvre, navigue vers Utilisateurs et se referme", async ({ page }) => {
    const staff = await createTestStaff({ role: "SUPER_ADMIN", scope: "resp-drawer" });
    await loginAndEnter(page, staff, { kind: "platform" });

    const usersLink = page.locator("#app-shell-nav").getByRole("link", { name: "Utilisateurs" });
    await expect(usersLink).toBeHidden();

    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await expect(usersLink).toBeVisible();

    await usersLink.click();
    await expect(page).toHaveURL(/\/platform\/users/);
    // Le changement de route referme le tiroir.
    await expect(usersLink).toBeHidden();
    await expect(page.getByRole("button", { name: "Ouvrir le menu" })).toBeVisible();
  });

  // --- Absence de débordement horizontal --------------------------------------

  test("Platform : aucune page ne déborde horizontalement", async ({ page }) => {
    const staff = await createTestStaff({ role: "SUPER_ADMIN", scope: "resp-platform" });
    await loginAndEnter(page, staff, { kind: "platform" });

    for (const path of [
      "/platform",
      "/platform/organizations",
      "/platform/users",
      "/platform/activity",
    ]) {
      await expectNoHorizontalOverflow(page, path);
    }
  });

  test("Event : aucune page ne déborde horizontalement", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "resp-event" });
    await createTestCategory({ eventId, name: "Intervenant très long nom de catégorie" });
    const participant = await createTestUser({
      scope: "resp-event-p",
      verified: true,
      profile: true,
    });
    await createTestRegistration({ eventId, userId: participant.id, categoryId });
    const admin = await makeEventAdminUser({ scope: "resp-event-a", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    for (const sub of ["", "/registrations", "/scan", "/members"]) {
      await expectNoHorizontalOverflow(page, `/event/${eventId}${sub}`);
    }
  });

  test("Compte : aucune page ne déborde horizontalement", async ({ page }) => {
    const { eventId, categoryId } = await createTestEvent({ scope: "resp-account" });
    const user = await createTestUser({ scope: "resp-account-u", verified: true, profile: true });
    await createTestRegistration({ eventId, userId: user.id, categoryId });
    await loginAs(page, user);

    for (const path of ["/account", "/account/profile", "/account/notifications"]) {
      await expectNoHorizontalOverflow(page, path);
    }
  });

  test("Public : la page publique d'un événement ne déborde pas horizontalement", async ({
    page,
  }) => {
    const { eventSlug } = await createTestEvent({ scope: "resp-public" });
    await expectNoHorizontalOverflow(page, `/e/${eventSlug}`);
  });

  // --- Déconnexion depuis le tiroir ---------------------------------------------

  test("Déconnexion depuis le tiroir : la modale est centrée dans la fenêtre", async ({ page }) => {
    const staff = await createTestStaff({ role: "SUPER_ADMIN", scope: "resp-logout" });
    await loginAndEnter(page, staff, { kind: "platform" });

    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await page
      .locator("#app-shell-nav")
      .getByRole("button", { name: /^déconnexion$/i })
      .click();

    const dialog = page.getByRole("dialog", { name: "Se déconnecter" });
    await expect(dialog).toBeVisible();

    // La modale est rendue en portail : elle n'est pas contrainte par l'aside du tiroir.
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    const { x, y, width, height } = box!;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + width).toBeLessThanOrEqual(VIEWPORT.width);
    expect(y + height).toBeLessThanOrEqual(VIEWPORT.height);
    // Plus large que le tiroir (w-64 = 256 px) : preuve qu'elle n'est pas dans l'aside.
    expect(width).toBeGreaterThan(256);

    await page.getByRole("button", { name: /^annuler$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/platform/);
  });
});
