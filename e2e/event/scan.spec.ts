import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestRegistration,
  createTestUser,
  disconnectDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { loginAndEnter } from "../helpers/nav";
import { expectLastActivity } from "../helpers/audit";
import { makeEventAdminUser } from "../helpers/db";

// Page Scanner — /event/[eventId]/scan
// Rôles : OPERATOR + ADMIN (PRINTER/VIEWER refuses). Deux modes de saisie :
// camera (Html5Qrcode, NON automatisable en E2E) et saisie manuelle (testee ici).
// Le check-in direct par regId n'a pas de surface UI : teste en API.
test.describe("Event — Scanner", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });








  // --- Actions UI (saisie manuelle) ---------------------------------------

  test("Saisie manuelle d'un code valide -> 'Accès autorisé'", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "scan-ui-ok" });
    const operator = await createTestEventMember({
      scope: "scan-ui-ok",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    const participant = await createTestUser({
      scope: "scan-ui-ok-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "APPROVED",
    });
    await loginAs(page, operator);

    await page.goto(`/event/${eventId}/scan`);
    await page.getByRole("button", { name: /saisie manuelle/i }).click();
    await page.getByPlaceholder(/id de badge ou contenu qr/i).fill(reg.id);
    await page.getByRole("button", { name: /^vérifier$/i }).click();

    await expect(page.getByText(/accès autorisé/i)).toBeVisible();

    await expectLastActivity({
      type: "BADGE_SCANNED",
      userId: operator.id,
      eventId,
      targetId: reg.id,
    });
  });

  test("Saisie manuelle d'un code rejete -> 'Accès refusé'", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "scan-ui-rej" });
    const operator = await createTestEventMember({
      scope: "scan-ui-rej",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    const participant = await createTestUser({
      scope: "scan-ui-rej-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "REJECTED",
    });
    await loginAs(page, operator);

    await page.goto(`/event/${eventId}/scan`);
    await page.getByRole("button", { name: /saisie manuelle/i }).click();
    await page.getByPlaceholder(/id de badge ou contenu qr/i).fill(reg.id);
    await page.getByRole("button", { name: /^vérifier$/i }).click();

    await expect(page.getByText(/accès refusé/i)).toBeVisible();
  });

  // --- Acces & gardes de role ---------------------------------------------

  test("ADMIN accede aussi au scanner", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "scan-admin" });
    const admin = await makeEventAdminUser({ scope: "scan-admin", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/scan`);
    await expect(page.getByRole("button", { name: /saisie manuelle/i })).toBeVisible();
  });

  test("VIEWER ne voit pas le scanner dans son shell", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "scan-viewer" });
    const viewer = await createTestEventMember({
      scope: "scan-viewer-user",
      orgId,
      eventId,
      role: "VIEWER",
    });
    await loginAndEnter(page, viewer, { kind: "event", id: eventId });

    // Le shell VIEWER n'expose que la vue d'ensemble : pas d'entree Scanner.
    await expect(page.getByRole("link", { name: /scanner/i })).toHaveCount(0);
  });

  test("PRINTER ne voit pas le scanner dans son shell", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "scan-printer" });
    const printer = await createTestEventMember({
      scope: "scan-printer-user",
      orgId,
      eventId,
      role: "PRINTER",
    });
    await loginAndEnter(page, printer, { kind: "event", id: eventId });

    // Le shell PRINTER n'expose que les badges : pas d'entree Scanner.
    await expect(page.getByRole("link", { name: /scanner/i })).toHaveCount(0);
  });});
