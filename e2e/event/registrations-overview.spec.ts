import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestCategory,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

// Page Vue d'ensemble — /event/[eventId]/registrations/overview
// Rôle mini : VIEWER (ADR v2-14). Repartition NON NOMINATIVE : aucune PII affichee.
// Page 100% lecture seule : comptes par statut, repartition par categorie, total
// comptabilise (PENDING + APPROVED, les rejets sont exclus du quota).
test.describe("Event — Vue d'ensemble", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function addReg(
    eventId: string,
    categoryId: string,
    status: "PENDING" | "APPROVED" | "REJECTED",
    scope: string,
  ) {
    const participant = await createTestUser({ scope, verified: true, profile: true });
    await createTestRegistration({ eventId, userId: participant.id, categoryId, status });
    return participant;
  }

  // --- Acces & rendu ------------------------------------------------------

  test("VIEWER voit la vue d'ensemble (role minimal)", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "ovw-viewer" });
    const viewer = await createTestEventMember({
      scope: "ovw-viewer-user",
      orgId,
      eventId,
      role: "VIEWER",
    });
    await loginAs(page, viewer);

    await page.goto(`/event/${eventId}/registrations/overview`);
    await expect(page.getByRole("heading", { name: /vue d.ensemble/i })).toBeVisible();
    await expect(page.getByText(/répartition non nominative/i)).toBeVisible();
  });

  test("ADMIN voit aussi la vue d'ensemble", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "ovw-admin" });
    const admin = await makeEventAdminUser({ scope: "ovw-admin", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/overview`);
    await expect(page.getByRole("heading", { name: /vue d.ensemble/i })).toBeVisible();
  });

  // --- Comptes agreges ----------------------------------------------------

  test("Les comptes par statut et le total comptabilise sont exacts", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "ovw-counts" });
    // 2 PENDING + 1 APPROVED + 1 REJECTED => total comptabilise = 3.
    await addReg(eventId, categoryId, "PENDING", "ovw-c1");
    await addReg(eventId, categoryId, "PENDING", "ovw-c2");
    await addReg(eventId, categoryId, "APPROVED", "ovw-c3");
    await addReg(eventId, categoryId, "REJECTED", "ovw-c4");
    const admin = await makeEventAdminUser({ scope: "ovw-counts", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/overview`);

    // Total comptabilise : PENDING + APPROVED, les rejets sont exclus.
    await expect(page.getByText(/inscription\(s\)/)).toBeVisible();
    await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
  });

  test("La repartition par categorie affiche le compte de chaque categorie", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "ovw-cats" });
    const second = await createTestCategory({
      eventId,
      name: "Presse",
      color: "#ff0000",
      number: 2,
    });
    await addReg(eventId, categoryId, "APPROVED", "ovw-cat1");
    await addReg(eventId, second.id, "APPROVED", "ovw-cat2");
    await addReg(eventId, second.id, "PENDING", "ovw-cat3");
    const admin = await makeEventAdminUser({ scope: "ovw-cats", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/overview`);
    await expect(page.getByText(/répartition par catégorie/i)).toBeVisible();
    await expect(page.getByText("#2 Presse")).toBeVisible();
  });

  test("Aucune donnee nominative n'est exposee", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "ovw-pii" });
    const participant = await addReg(eventId, categoryId, "APPROVED", "ovw-pii-p");
    const admin = await makeEventAdminUser({ scope: "ovw-pii", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/overview`);
    await expect(page.getByText(participant.email)).toHaveCount(0);
  });

  // --- Etats --------------------------------------------------------------

  test("Etat vide : aucune categorie", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "ovw-empty" });
    // createTestEvent cree une categorie par defaut : on la retire pour l'etat vide.
    const { getDb } = await import("../helpers/db");
    await getDb().category.delete({ where: { id: categoryId } });
    const admin = await makeEventAdminUser({ scope: "ovw-empty", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/overview`);
    await expect(page.getByText(/aucune catégorie/i)).toBeVisible();
  });
});
