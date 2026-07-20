import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
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

  test("La page de detail d'un badge s'affiche", async ({ page }) => {
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
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/badges/${reg.id}`);
    await expect(page.getByRole("link", { name: /voir l'inscription/i })).toBeVisible();
  });

  test("L'apercu par lot rend les badges demandes", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "bdg-batch" });
    const admin = await makeEventAdminUser({ scope: "bdg-batch", eventId, orgId });
    const participant = await createTestUser({
      scope: "bdg-batch-p",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "APPROVED",
    });
    await loginAs(page, admin);

    // /badges/print est un apercu PDF : pas de bouton d'action.
    const res = await page.goto(`/event/${eventId}/badges/print?ids=${reg.id}`);
    expect(res?.status()).toBe(200);
  });

  // --- Etats --------------------------------------------------------------

  test("Etat vide : aucun badge a imprimer", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "bdg-empty" });
    const admin = await makeEventAdminUser({ scope: "bdg-empty", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/badges`);
    await expect(page.getByText(/aucun badge/i)).toBeVisible();
  });
});
