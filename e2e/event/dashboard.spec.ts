import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestEventMember,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";

// Page Tableau de bord evenement — /event/[eventId]
// Accessible a tous les roles event, mais le SHELL differe : ADMIN/STAFF voient la
// nav complete, OPERATOR le scanner, PRINTER les badges, VIEWER la vue d'ensemble.
// Page 100% lecture seule : KPI, banniere de quota, dernieres inscriptions.
test.describe("Event — Tableau de bord", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN voit dashboard complet avec KPI", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "dash-admin" });
    const admin = await makeEventAdminUser({ scope: "dash-admin", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/tableau de bord de l'événement/i).first()).toBeVisible();
    // KPI 4 statuts + badges imprimes
    await expect(page.getByText(/en attente/i).first()).toBeVisible();
    await expect(page.getByText(/approuvées/i).first()).toBeVisible();
    await expect(page.getByText(/rejetées/i).first()).toBeVisible();
    await expect(page.getByText(/badges imprimés/i).first()).toBeVisible();
  });

  test("ADMIN voit la carte d'informations de l'evenement", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({
      scope: "dash-info",
      date: new Date("2026-12-15T00:00:00Z"),
      endDate: new Date("2026-12-17T00:00:00Z"),
    });
    const admin = await makeEventAdminUser({ scope: "dash-info", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}$`));
    await expect(page.getByText(/informations de l'événement/i)).toBeVisible();
    await expect(page.getByText(/Du 15 Décembre . 2026 au 17 Décembre . 2026/)).toBeVisible();
    await expect(page.getByText("Abidjan")).toBeVisible();
    await expect(page.getByText(/inscriptions ouvertes/i).first()).toBeVisible();
  });

  test("OPERATOR voit Mes scans et lien scanner", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "dash-operator" });
    const operator = await createTestEventMember({
      scope: "dash-operator",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    await loginAndEnter(page, operator, { kind: "event", id: eventId });

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
    await loginAndEnter(page, printer, { kind: "event", id: eventId });

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
    await loginAndEnter(page, viewer, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/tableau de bord de l'événement/i).first()).toBeVisible();
    await expect(page.getByText(/en attente/i).first()).toBeVisible();
    await expect(page.getByText(/approuvées/i).first()).toBeVisible();
    // v4 Bloc D : le membre VIEWER (event-only) atteint son evenement et obtient le
    // shell dedie VIEWER, reconnaissable a l'en-tete "Lecture — <titre>".
    await expect(page.getByText(/lecture —/i)).toBeVisible();
  });

  // --- Lien d'inscription public -------------------------------------------

  test("ADMIN voit le lien d'inscription public et peut le copier", async ({ page, context }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "dash-publink" });
    const slug = (await getDb().event.findUniqueOrThrow({
      where: { id: eventId },
      select: { slug: true },
    })).slug;
    const admin = await makeEventAdminUser({ scope: "dash-publink", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/event/${eventId}`);

    const field = page.getByLabel(/lien d'inscription public/i);
    await expect(field).toHaveValue(new RegExp(`/e/${slug}$`));

    await page.getByRole("button", { name: /copier/i }).click();
    await expect(page.getByRole("button", { name: /copié/i })).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain(`/e/${slug}`);
  });

  test("Le lien 'Ouvrir' mene a la page publique de l'evenement", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "dash-publink-open" });
    const slug = (await getDb().event.findUniqueOrThrow({
      where: { id: eventId },
      select: { slug: true },
    })).slug;
    const admin = await makeEventAdminUser({ scope: "dash-publink-open", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}`);
    const [publicPage] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("link", { name: /ouvrir/i }).click(),
    ]);
    await expect(publicPage).toHaveURL(new RegExp(`/e/${slug}$`));
  });

  test("Inscriptions fermees : la carte du lien public le signale", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "dash-publink-closed" });
    await getDb().event.update({ where: { id: eventId }, data: { registrationOpen: false } });
    const admin = await makeEventAdminUser({ scope: "dash-publink-closed", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/inscriptions fermées/i)).toBeVisible();
  });

  // --- Etats --------------------------------------------------------------

  test("Etat vide : aucune inscription", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "dash-empty" });
    const admin = await makeEventAdminUser({ scope: "dash-empty", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/aucune inscription pour le moment/i)).toBeVisible();
  });

  test("Quota d'inscriptions > 80% : banniere affichee", async ({ page }) => {
    // Plan limite a 2 participants/event, 2 inscriptions comptables => 100%.
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "dash-quota" });
    await getDb().plan.updateMany({
      where: { subscriptions: { some: { org: { events: { some: { id: eventId } } } } } },
      data: { maxParticipantsPerEvent: 2 },
    });
    for (let i = 0; i < 2; i++) {
      const participant = await createTestUser({
        scope: `dash-quota-p${i}`,
        verified: true,
        profile: true,
      });
      await createTestRegistration({
        eventId,
        userId: participant.id,
        categoryId,
        status: "APPROVED",
      });
    }
    const admin = await makeEventAdminUser({ scope: "dash-quota", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/quota d'inscriptions dépasse 80/i)).toBeVisible();
  });

  test("Quota sous le seuil : pas de banniere", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "dash-noquota" });
    const admin = await makeEventAdminUser({ scope: "dash-noquota", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}`);
    await expect(page.getByText(/quota d'inscriptions dépasse 80/i)).toHaveCount(0);
  });

  // --- Navigation ---------------------------------------------------------

  test("Le lien 'Tout voir' mene a la liste des inscriptions", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "dash-nav" });
    const participant = await createTestUser({
      scope: "dash-nav-p",
      verified: true,
      profile: true,
    });
    await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "PENDING",
    });
    const admin = await makeEventAdminUser({ scope: "dash-nav", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}`);
    await page.getByRole("link", { name: /tout voir/i }).first().click();
    await page.waitForURL(`**/event/${eventId}/registrations`);
  });
});
