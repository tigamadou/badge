import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestPrintRequest,
  createTestStaff,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";

const LINES = [{ label: "Support badge PVC", quantity: 10, unitPrice: 1500, kind: "PRODUCT" as const }];

// Page Commandes d'impression — /platform/print/orders
// Rôle : tout le staff y accède, STAFF_OBSERVER compris (lecture seule). Le menu « Commandes »
// porte une pastille : le nombre de commandes envoyées (SUBMITTED) en attente de traitement.
// Les brouillons ne sont jamais visibles du staff.
test.describe("Platform — Commandes d'impression", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("STAFF_OBSERVER voit la liste des commandes envoyées, sans les brouillons", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "prq-observer" });
    const organizer = await createTestUser({ scope: "prq-observer-org", verified: true });
    const sent = await createTestPrintRequest({ eventId, orgId, createdById: organizer.id, status: "SUBMITTED", lines: LINES });
    const draft = await createTestPrintRequest({ eventId, orgId, createdById: organizer.id, status: "DRAFT", lines: LINES });
    const observer = await createTestStaff({ scope: "prq-observer", role: "STAFF_OBSERVER" });
    await loginAndEnter(page, observer, { kind: "platform" });

    await page.getByRole("link", { name: /^Commandes/ }).click();
    await expect(page).toHaveURL(/\/platform\/print\/orders$/);
    await expect(page.getByRole("heading", { name: "Commandes d'impression" })).toBeVisible();

    const row = page.locator("tr", { hasText: sent.reference });
    await expect(row).toContainText("Envoyée");
    await expect(row).toContainText("E2E Org");
    await expect(row).toContainText("Salon E2E");
    await expect(row).toContainText("En amont");
    await expect(page.getByText(draft.reference)).toHaveCount(0);

    // La référence ouvre le détail.
    await row.getByRole("link", { name: sent.reference }).click();
    await expect(page).toHaveURL(new RegExp(`/platform/print/orders/${sent.id}$`));
  });

  test("La pastille « Commandes » compte les commandes envoyées en attente", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "prq-counter" });
    const organizer = await createTestUser({ scope: "prq-counter-org", verified: true });
    for (let i = 0; i < 2; i++) {
      await createTestPrintRequest({ eventId, orgId, createdById: organizer.id, status: "SUBMITTED", lines: LINES });
    }
    // Les commandes déjà devisées ne comptent pas.
    await createTestPrintRequest({ eventId, orgId, createdById: organizer.id, status: "QUOTED", lines: LINES });
    const expected = await getDb().printRequest.count({ where: { status: "SUBMITTED" } });
    expect(expected).toBeGreaterThanOrEqual(2);
    const support = await createTestStaff({ scope: "prq-counter", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });

    const badge = page.locator('a[href="/platform/print/orders"] [aria-label$="en attente"]').first();
    await expect(badge).toHaveText(String(expected));
    await expect(badge).toHaveAttribute("aria-label", `${expected} en attente`);
  });

  test("Le filtre de statut ne garde que les commandes du statut choisi", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "prq-filter" });
    const organizer = await createTestUser({ scope: "prq-filter-org", verified: true });
    const sent = await createTestPrintRequest({ eventId, orgId, createdById: organizer.id, status: "SUBMITTED", lines: LINES });
    const quoted = await createTestPrintRequest({ eventId, orgId, createdById: organizer.id, status: "QUOTED", lines: LINES });
    const support = await createTestStaff({ scope: "prq-filter", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });

    await page.getByRole("link", { name: /^Commandes/ }).click();
    await expect(page).toHaveURL(/\/platform\/print\/orders$/);
    await page.getByLabel("Organisation").selectOption(orgId);
    await page.getByLabel("Statut").selectOption("QUOTED");
    await page.getByRole("button", { name: "Filtrer" }).click();

    await expect(page).toHaveURL(/status=QUOTED/);
    await expect(page).toHaveURL(new RegExp(`orgId=${orgId}`));
    await expect(page.locator("tr", { hasText: quoted.reference })).toContainText("Devis envoyé");
    await expect(page.getByText(sent.reference)).toHaveCount(0);
  });

  test("Un filtre sans résultat affiche l'état vide", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "prq-empty" });
    const organizer = await createTestUser({ scope: "prq-empty-org", verified: true });
    await createTestPrintRequest({ eventId, orgId, createdById: organizer.id, status: "SUBMITTED", lines: LINES });
    const support = await createTestStaff({ scope: "prq-empty", role: "STAFF_SUPPORT" });
    await loginAndEnter(page, support, { kind: "platform" });

    await page.getByRole("link", { name: /^Commandes/ }).click();
    await expect(page).toHaveURL(/\/platform\/print\/orders$/);
    // Cette organisation n'a qu'une commande envoyée : aucune n'est payée.
    await page.getByLabel("Organisation").selectOption(orgId);
    await page.getByLabel("Statut").selectOption("PAID");
    await page.getByRole("button", { name: "Filtrer" }).click();

    await expect(page).toHaveURL(/status=PAID/);
    await expect(page.getByText("Aucune commande ne correspond à ces filtres.")).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });
});

// Anciennes URL (liens d'e-mails et de notifications déjà envoyés) : redirection permanente.
test.describe("Platform — Redirection des anciennes URL de commandes", () => {
  test("/platform/print/requests et /platform/print/requests/:id redirigent vers /orders", async ({ request }) => {
    const list = await request.get("/platform/print/requests", { maxRedirects: 0 });
    expect(list.status()).toBe(308);
    expect(new URL(list.headers()["location"], "http://localhost").pathname).toBe("/platform/print/orders");

    const detail = await request.get("/platform/print/requests/abc/onsite", { maxRedirects: 0 });
    expect(detail.status()).toBe(308);
    expect(new URL(detail.headers()["location"], "http://localhost").pathname).toBe("/platform/print/orders/abc/onsite");
  });
});
