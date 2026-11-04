import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createManyTestRegistrations,
  createTestEvent,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { expectNoHorizontalOverflow, expectPagination, selectPageSize } from "../helpers/pagination";

// Pagination des listes de l'espace evenement (page / pageSize dans l'URL).
test.describe("Event — Pagination des listes", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("Badges et inscriptions : tailles, pages, filtre, page hors bornes", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "pg-evt" });
    const admin = await makeEventAdminUser({ scope: "pg-evt", eventId, orgId });
    await createManyTestRegistrations({ scope: "pg-evt", eventId, categoryId, count: 45 });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    // Inscriptions : defaut 20 lignes.
    await page.getByRole("link", { name: /inscriptions/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/registrations`));
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expectPagination(page, { total: 45, pageSize: 20 });

    await selectPageSize(page, 10);
    await expect(page.locator("tbody tr")).toHaveCount(10);
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expectPagination(page, { total: 45, pageSize: 10, page: 2 });

    // L'etat persiste au rechargement.
    await page.reload();
    await expectPagination(page, { total: 45, pageSize: 10, page: 2 });

    // Page hors bornes : bornee a la derniere page (45 / 10 => 5).
    await page.goto(`/event/${eventId}/registrations?pageSize=10&page=99`);
    await expect(page).toHaveURL(/page=5/);
    await expect(page.locator("tbody tr")).toHaveCount(5);
    // Taille invalide : retombe sur le defaut.
    await page.goto(`/event/${eventId}/registrations?pageSize=7`);
    await expect(page.locator("tbody tr")).toHaveCount(20);

    // Badges : defaut 100, donc les 45 sur une page ; filtre « Imprimés » remet la page a 1.
    await page.goto(`/event/${eventId}/badges?filter=all`);
    await expect(page.getByRole("checkbox")).toHaveCount(45);
    await selectPageSize(page, 10);
    await expect(page.getByRole("checkbox")).toHaveCount(10);
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page).toHaveURL(/page=2/);
    await page.getByLabel("Filtrer les badges").selectOption("printed");
    await expect(page).toHaveURL(/filter=printed/);
    await expect(page).not.toHaveURL(/page=/);
    await expect(page).toHaveURL(/pageSize=10/);
    await expect(page.getByText(/aucun badge/i)).toBeVisible();

    await page.goto(`/event/${eventId}/badges?filter=all&pageSize=10&page=99`);
    await expect(page).toHaveURL(/page=5/);
    await expect(page.getByRole("checkbox")).toHaveCount(5);

    for (const width of [375, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/event/${eventId}/registrations`);
      await expect(page.locator("tbody tr")).toHaveCount(20);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("Catégories : 41 lignes (40 + la catégorie par défaut), la suppression de la seule ligne de la dernière page la rabat sur la précédente", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "pg-cat" });
    const admin = await makeEventAdminUser({ scope: "pg-cat", eventId, orgId });
    await getDb().category.createMany({
      data: Array.from({ length: 40 }, (_, i) => ({
        eventId,
        name: `Pg cat ${String(i).padStart(2, "0")}`,
        color: "#336699",
        number: 100 + i,
      })),
    });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    page.on("dialog", (d) => d.accept());

    await page.goto(`/event/${eventId}/categories`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await page.getByRole("button", { name: "3", exact: true }).click();
    await expect(page).toHaveURL(/page=3/);
    await expect(page.locator("tbody tr")).toHaveCount(1);

    await page.locator("tbody tr").first().getByLabel("Supprimer").click();
    // Après router.refresh(), la page 3 n'existe plus : retour sur la page 2 (20 lignes), jamais un tableau vide.
    await expect(page.getByText("40 résultats", { exact: true })).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expect(page.locator("button[aria-current=\"page\"]")).toHaveText("2");
  });

  test("Membres : 25 membres paginés par défaut à 20", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "pg-mem" });
    const admin = await makeEventAdminUser({ scope: "pg-mem", eventId, orgId });
    const db = getDb();
    const stamp = Date.now();
    const emails = Array.from({ length: 24 }, (_, i) => `e2e-pg-mem-${stamp}-${i}@v2-11-e2e.test`);
    await db.user.createMany({ data: emails.map((email) => ({ email, password: "x", name: "E2E Membre" })) });
    const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    await db.eventMembership.createMany({
      data: users.map((u) => ({ userId: u.id, eventId, role: "VIEWER" as const })),
    });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/members`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expectPagination(page, { total: 25, pageSize: 20 });
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(5);
    await expectNoHorizontalOverflow(page);
  });

  test("Blocage : chaque onglet pagine indépendamment", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "pg-blk" });
    const admin = await makeEventAdminUser({ scope: "pg-blk", eventId, orgId });
    const db = getDb();
    await db.blockedEmail.createMany({
      data: Array.from({ length: 23 }, (_, i) => ({ eventId, email: `pg-blk-${i}@example.test` })),
    });
    await db.blockedDocument.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({ eventId, documentNumber: `PG-BLK-${i}` })),
    });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/blocked-emails`);
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(3);

    // Changer d'onglet retire `page` et affiche la liste des documents (12 lignes).
    await page.getByRole("tab", { name: /documents/i }).click();
    await expect(page).toHaveURL(/tab=documents/);
    await expect(page).not.toHaveURL(/page=/);
    await expect(page.locator("tbody tr")).toHaveCount(12);
    await expectPagination(page, { total: 12, pageSize: 20 });
  });
});
