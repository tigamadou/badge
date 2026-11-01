import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestPrintRequest,
  disconnectDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";

// Page Impression — /event/[eventId]/print
// Rôle : permission `print.request` (ADMIN de l'évènement, OWNER ou MANAGER de l'organisation).
// Un OPERATOR n'a ni l'entrée de menu ni l'accès. L'assistant de création vit sur
// /print/new (print-new.spec.ts) et le détail sur /print/[requestId] (print-request-detail.spec.ts).
test.describe("Event — Impression", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN ouvre la liste via le menu et voit ses demandes avec leur statut", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-list" });
    const admin = await makeEventAdminUser({ scope: "print-list", eventId, orgId });
    const sent = await createTestPrintRequest({
      eventId,
      orgId,
      createdById: admin.id,
      status: "SUBMITTED",
      lines: [{ label: "Support badge", quantity: 10, unitPrice: 1500, kind: "PRODUCT" }],
    });
    const quoted = await createTestPrintRequest({
      eventId,
      orgId,
      createdById: admin.id,
      status: "QUOTED",
      lines: [{ label: "Support badge", quantity: 10, unitPrice: 1500, kind: "PRODUCT" }],
    });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.getByRole("link", { name: "Impression", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print$`));
    await expect(page.getByRole("heading", { name: "Impression", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nouvelle demande" })).toBeVisible();

    const sentRow = page.locator("tr", { hasText: sent.reference });
    await expect(sentRow).toContainText("Envoyée");
    await expect(sentRow).toContainText("En amont");
    const quotedRow = page.locator("tr", { hasText: quoted.reference });
    await expect(quotedRow).toContainText("Devis envoyé");

    // La référence ouvre le détail.
    await sentRow.getByRole("link", { name: sent.reference }).click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print/${sent.id}$`));
    await expect(page.getByRole("heading", { name: sent.reference })).toBeVisible();
  });

  test("« Nouvelle demande » ouvre l'assistant", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-new-link" });
    const admin = await makeEventAdminUser({ scope: "print-new-link", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.getByRole("link", { name: "Impression", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print$`));
    await page.getByRole("link", { name: "Nouvelle demande" }).click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print/new$`));
    await expect(page.getByRole("heading", { name: "Nouvelle demande d'impression" })).toBeVisible();
  });

  test("Sans demande, la liste affiche l'état vide", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-empty" });
    const admin = await makeEventAdminUser({ scope: "print-empty", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.getByRole("link", { name: "Impression", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print$`));
    await expect(page.getByText("Aucune demande d'impression pour cet évènement.")).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("Un OPERATOR ne voit pas l'entrée « Impression » et est renvoyé au tableau de bord", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "print-operator" });
    const operator = await createTestEventMember({ scope: "print-operator", eventId, orgId, role: "OPERATOR" });
    await loginAndEnter(page, operator, { kind: "event", id: eventId });

    await expect(page.getByRole("link", { name: "Impression", exact: true })).toHaveCount(0);

    // Accès direct refusé : retour au tableau de bord de l'évènement.
    await page.goto(`/event/${eventId}/print`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}$`));
  });
});
