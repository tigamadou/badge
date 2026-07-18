import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  disconnectDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

test.describe("T20 Event dashboard", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN voit dashboard complet avec KPI", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "dash-admin" });
    const admin = await makeEventAdminUser({ scope: "dash-admin", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/tableau de bord de l'événement/i).first()).toBeVisible();
    // KPI 4 statuts + badges imprimes
    await expect(page.getByText(/en attente/i).first()).toBeVisible();
    await expect(page.getByText(/approuvées/i).first()).toBeVisible();
    await expect(page.getByText(/rejetées/i).first()).toBeVisible();
    await expect(page.getByText(/badges imprimés/i).first()).toBeVisible();
  });

  test("OPERATOR voit Mes scans et lien scanner", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "dash-operator" });
    const operator = await createTestEventMember({
      scope: "dash-operator",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    await loginAs(page, operator);

    await page.goto(`/event/${eventId}`);
    await expect(page.getByRole("heading", { name: /tableau de bord opérateur/i })).toBeVisible();
    await expect(page.getByText(/mes scans/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /ouvrir le scanner/i })).toBeVisible();
  });

  test("PRINTER accede a la page event (dashboard partage en effective role PRINTER)", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "dash-printer" });
    const printer = await createTestEventMember({
      scope: "dash-printer",
      orgId,
      eventId,
      role: "PRINTER",
    });
    await loginAs(page, printer);

    // v4 Bloc D : le membre PRINTER (event-only, sans role org) atteint bien son
    // evenement (plus de redirect cascade). Il obtient le shell dedie PRINTER,
    // reconnaissable a l'en-tete "Impression — <titre>". La nav /badges est accessible.
    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/impression —/i)).toBeVisible();

    // Le lien "Badges" est present dans la sidebar.
    const badgesLink = page.getByRole("link", { name: /^badges$/i });
    await expect(badgesLink).toBeVisible();
    await badgesLink.click();
    await page.waitForURL(new RegExp(`/event/${eventId}/badges`), {
      timeout: 8000,
    });
  });

  test("VIEWER voit dashboard agrégé (KPI visibles)", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "dash-viewer" });
    const viewer = await createTestEventMember({
      scope: "dash-viewer",
      orgId,
      eventId,
      role: "VIEWER",
    });
    await loginAs(page, viewer);

    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/tableau de bord de l'événement/i).first()).toBeVisible();
    await expect(page.getByText(/en attente/i).first()).toBeVisible();
    await expect(page.getByText(/approuvées/i).first()).toBeVisible();
    // v4 Bloc D : le membre VIEWER (event-only) atteint son evenement et obtient le
    // shell dedie VIEWER, reconnaissable a l'en-tete "Lecture — <titre>".
    await expect(page.getByText(/lecture —/i)).toBeVisible();
  });
});
