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
import { expectLastActivity } from "../helpers/audit";

// Notes : le parcours badges (liste, PDF, marquage imprime) est garde par la
// permission `badge.print` (ADMIN, OPERATOR, PRINTER) et non par la hierarchie
// minRole, qui ne satisfait jamais un PRINTER pur. La liste passe par l'endpoint
// dedie GET /badges (DTO minimal, sans email ni structure).
// Page Badges — /event/[eventId]/badges (liste), /badges/[badgeId] (detail PDF),
// /badges/print (apercu par lot).
// Garde : permission `badge.print` (ADMIN, OPERATOR, PRINTER). La liste passe par
// l'endpoint dedie GET /badges (DTO minimal, sans e-mail ni structure).
test.describe("Event — Badges", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN marque une registration APPROVED comme imprimee (POST /registrations/print)", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "print-one" });
    const admin = await makeEventAdminUser({ scope: "print-one", eventId, orgId });
    const participant = await createTestUser({
      scope: "print-one-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "APPROVED",
    });

    // Parcours : login -> /select (2 espaces) -> carte event -> nav Badges.
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await page.getByRole("link", { name: /badges/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges`));

    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /marquer imprimés/i }).click();

    // Reponse attendue — SUCCES : le filtre "Non imprimés" n'affiche plus rien.
    await expect(page.getByText(/aucun badge/i)).toBeVisible();

    const db = getDb();
    const updated = await db.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.badgePrinted).toBe(true);
    expect(updated?.badgePrintedAt).not.toBeNull();

    const log = await expectLastActivity({
      type: "BADGE_BATCH_PRINTED",
      userId: admin.id,
      eventId,
    });
    expect((log.details as { count?: number })?.count).toBe(1);
  });

  // PAGE DE REFERENCE du contrat « test UI » : parcours complet (login ->
  // /select -> carte event -> nav du shell), URL verifiee a chaque etape,
  // action 100% UI, et reponse attendue assertee (feedback UI + DB + audit).
  test("ADMIN imprime un batch de 3 badges (parcours UI complet)", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "print-batch" });
    const admin = await makeEventAdminUser({ scope: "print-batch", eventId, orgId });

    const regs: { id: string }[] = [];
    for (let i = 0; i < 3; i++) {
      const p = await createTestUser({
        scope: `print-batch-p${i}`,
        verified: true,
        profile: true,
      });
      const r = await createTestRegistration({
        eventId,
        userId: p.id,
        categoryId,
        status: "APPROVED",
      });
      regs.push(r);
    }

    // 1. Connexion : l'ADMIN a 2 espaces (OWNER org + ADMIN event) -> /select.
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    // 2. Navigation par la nav du shell (pas de lien profond).
    await page.getByRole("link", { name: /badges/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges`));

    // 3. Action 100% UI : cocher les 3 lignes puis marquer imprimes.
    const checkboxes = page.getByRole("checkbox");
    await expect(checkboxes).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await checkboxes.nth(i).check();
    }
    await page.getByRole("button", { name: /marquer imprimés/i }).click();

    // 4. Reponse attendue — SUCCES :
    //    (a) feedback UI : le filtre "Non imprimés" ne montre plus aucune ligne
    await expect(page.getByText(/aucun badge/i)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges`));
    //    (b) effet persistant : DB + audit
    const printedCount = await getDb().registration.count({
      where: { id: { in: regs.map((r) => r.id) }, badgePrinted: true },
    });
    expect(printedCount).toBe(3);

    const log = await expectLastActivity({
      type: "BADGE_BATCH_PRINTED",
      userId: admin.id,
      eventId,
    });
    expect((log.details as { count?: number })?.count).toBe(3);
  });

  // --- Actions UI ---------------------------------------------------------

  test("La page d'un badge montre le PDF serveur et marque imprime", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "bdg-detail" });
    const admin = await makeEventAdminUser({ scope: "bdg-detail", eventId, orgId });
    const participant = await createTestUser({
      scope: "bdg-detail-p",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "APPROVED",
    });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/badges/${reg.id}`);
    await expect(page.getByRole("link", { name: /voir l'inscription/i })).toBeVisible();
    await expect(page.locator('iframe[title="Aperçu du badge"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Télécharger" })).toHaveAttribute(
      "href",
      `/api/org/${orgId}/events/${eventId}/badges/${reg.id}?download=1`,
    );

    // Le PDF servi est celui du moteur.
    const pdf = await page.request.get(`/api/org/${orgId}/events/${eventId}/badges/${reg.id}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");

    // Marquage explicite.
    await page.getByRole("button", { name: "Marquer imprimé" }).click();
    await expect(page.getByText(/imprimé le/i)).toBeVisible();
    const updated = await getDb().registration.findUnique({ where: { id: reg.id } });
    expect(updated?.badgePrinted).toBe(true);
    await expectLastActivity({ type: "BADGE_PRINTED", userId: admin.id, eventId });
  });

  test("La page de lot montre le PDF serveur et livre un ZIP", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "bdg-batch" });
    const admin = await makeEventAdminUser({ scope: "bdg-batch", eventId, orgId });
    const participant = await createTestUser({ scope: "bdg-batch-p", verified: true, profile: true });
    const reg = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "APPROVED" });
    const pendingUser = await createTestUser({ scope: "bdg-batch-q", verified: true, profile: true });
    const pending = await createTestRegistration({
      eventId,
      userId: pendingUser.id,
      categoryId,
      status: "PENDING",
    });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    const res = await page.goto(`/event/${eventId}/badges/print?ids=${reg.id},${pending.id},inconnu`);
    expect(res?.status()).toBe(200);
    await expect(page.getByText("2 identifiant(s) ignoré(s) : introuvables ou non approuvés.")).toBeVisible();
    await expect(page.locator('iframe[title="Aperçu du badge"]')).toHaveAttribute(
      "src",
      `/api/org/${orgId}/events/${eventId}/badges/${reg.id}`,
    );

    const zipLink = page.getByRole("link", { name: "Télécharger le lot (.zip)" });
    const href = await zipLink.getAttribute("href");
    const zip = await page.request.get(href!);
    expect(zip.status()).toBe(200);
    expect(zip.headers()["content-type"]).toBe("application/zip");

    await page.getByRole("button", { name: "Marquer imprimés" }).click();
    await expect(page.getByText("1 badge(s) marqué(s) imprimé(s).")).toBeVisible();
    await expectLastActivity({ type: "BADGE_BATCH_PRINTED", userId: admin.id, eventId });
  });

  // --- Garde des pages -----------------------------------------------------

  test("Un VIEWER pur est redirige hors des pages de badge, sans voir le participant", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "bdg-viewer" });
    const viewer = await createTestEventMember({ scope: "bdg-viewer", eventId, orgId, role: "VIEWER" });
    const participant = await createTestUser({ scope: "bdg-viewer-p", verified: true, profile: true });
    const reg = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "APPROVED" });
    await loginAndEnter(page, viewer, { kind: "event", id: eventId });

    for (const path of [`/event/${eventId}/badges/print?ids=${reg.id}`, `/event/${eventId}/badges/${reg.id}`]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/event/${eventId}$`));
      // Le tableau de bord de l'evenement liste d'autres informations (accessibles au VIEWER) :
      // on verifie donc l'absence du contenu propre aux pages de badge.
      await expect(page.getByRole("heading", { name: "Impression par lot" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /voir l'inscription/i })).toHaveCount(0);
      await expect(page.getByText(reg.id)).toHaveCount(0);
    }
  });

  // --- Etats --------------------------------------------------------------

  test("Etat vide : aucun badge a imprimer", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "bdg-empty" });
    const admin = await makeEventAdminUser({ scope: "bdg-empty", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/badges`);
    await expect(page.getByText(/aucun badge/i)).toBeVisible();
  });
});
