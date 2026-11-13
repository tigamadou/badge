import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createManyTestRegistrations,
  createTestEventMember,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
} from "../helpers/db";
import { selectPageSize } from "../helpers/pagination";
import { loginAndEnter } from "../helpers/nav";
import { expectLastActivity } from "../helpers/audit";
import { toast } from "../helpers/feedback";

// Notes : le parcours badges (liste, apercu HTML, PDF, marquage imprime) est garde par la
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

  test("La page d'un badge montre l'aperçu HTML et marque imprimé", async ({ page }) => {
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

    await page.getByRole("link", { name: /badges/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges`));
    await page.locator(`a[href="/event/${eventId}/badges/${reg.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges/${reg.id}`));
    await expect(page.getByRole("link", { name: /voir l'inscription/i })).toBeVisible();

    // Aperçu : le document figé est affiché par <page-view>, dans son iframe.
    await expect(page.locator('[data-testid="badge-document"]')).toHaveAttribute("data-state", "ready");
    await expect(page.frameLocator("page-view iframe").getByText("Awa").first()).toBeVisible();

    // Télécharger : le PDF du service, en pièce jointe.
    const downloadLink = page.getByRole("link", { name: "Télécharger" });
    await expect(downloadLink).toHaveAttribute(
      "href",
      `/api/org/${orgId}/events/${eventId}/badges/${reg.id}?download=1`,
    );
    const [download] = await Promise.all([page.waitForEvent("download"), downloadLink.click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges/${reg.id}`));

    // Imprimer : le PDF s'ouvre dans un nouvel onglet. Le Chromium headless de la CI n'affiche
    // pas les PDF (l'onglet n'atteint jamais « load ») : on vérifie le lien et le PDF servi.
    const printLink = page.getByRole("link", { name: "Imprimer" });
    await expect(printLink).toHaveAttribute("target", "_blank");
    const printHref = await printLink.getAttribute("href");
    expect(printHref).toMatch(new RegExp(`/badges/${reg.id}$`));
    const pdfResponse = await page.request.get(printHref!);
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    const [popup] = await Promise.all([page.waitForEvent("popup"), printLink.click()]);
    await popup.close();

    // Marquage explicite.
    await page.getByRole("button", { name: "Marquer imprimé" }).click();
    await expect(page.getByText(/imprimé le/i)).toBeVisible();
    const updated = await getDb().registration.findUnique({ where: { id: reg.id } });
    expect(updated?.badgePrinted).toBe(true);
    await expectLastActivity({ type: "BADGE_PRINTED", userId: admin.id, eventId });
  });

  test("Aperçu indisponible puis réessai", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "bdg-retry" });
    const admin = await makeEventAdminUser({ scope: "bdg-retry", eventId, orgId });
    const participant = await createTestUser({ scope: "bdg-retry-p", verified: true, profile: true });
    const reg = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "APPROVED" });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    const htmlRoute = /\/badges\/[^/]+\?format=html/;
    await page.route(htmlRoute, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "RENDERER_UNAVAILABLE",
          message: "Le service de rendu des badges est indisponible. Réessayez dans un instant.",
        }),
      }),
    );
    await page.getByRole("link", { name: /badges/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges`));
    await page.locator(`a[href="/event/${eventId}/badges/${reg.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges/${reg.id}`));

    const view = page.locator('[data-testid="badge-document"]');
    await expect(view).toHaveAttribute("data-state", "error");
    await expect(page.getByText("Le service de rendu des badges est indisponible. Réessayez dans un instant.")).toBeVisible();

    await page.unroute(htmlRoute);
    await page.getByRole("button", { name: "Aperçu indisponible, réessayer" }).click();
    await expect(view).toHaveAttribute("data-state", "ready");
  });

  test("La page de lot montre l'aperçu, ignore une réponse périmée et livre un ZIP asynchrone", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "bdg-batch" });
    const admin = await makeEventAdminUser({ scope: "bdg-batch", eventId, orgId });
    const participant = await createTestUser({ scope: "bdg-batch-p", verified: true, profile: true });
    const reg = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "APPROVED" });
    const second = await createTestUser({ scope: "bdg-batch-r", verified: true, profile: true });
    const reg2 = await createTestRegistration({ eventId, userId: second.id, categoryId, status: "APPROVED" });
    const pendingUser = await createTestUser({ scope: "bdg-batch-q", verified: true, profile: true });
    const pending = await createTestRegistration({
      eventId,
      userId: pendingUser.id,
      categoryId,
      status: "PENDING",
    });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    const urlOf = (id: string) => `/api/org/${orgId}/events/${eventId}/badges/${id}?format=html`;
    // La selection voyage par sessionStorage (cle `?sel=`), jamais dans l'URL.
    const selKey = "e2e-selection";
    await page.evaluate(
      ([key, ids]) => window.sessionStorage.setItem(`badge-batch-sel:${key}`, JSON.stringify(ids)),
      [selKey, [reg.id, reg2.id, pending.id, "inconnu"]] as const,
    );
    const res = await page.goto(`/event/${eventId}/badges/print?sel=${selKey}`);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges/print\\?sel=${selKey}$`));
    await expect(page.getByText("2 identifiant(s) ignoré(s) : introuvables ou non approuvés.")).toBeVisible();

    const view = page.locator('[data-testid="badge-document"]');
    await expect(view).toHaveAttribute("data-requested-src", urlOf(reg.id));
    await expect(view).toHaveAttribute("data-src", urlOf(reg.id));
    await expect(view).toHaveAttribute("data-state", "ready");

    // Changements rapides de badge : l'aperçu final est celui du dernier badge choisi.
    const item = (id: string) => page.getByRole("button", { name: new RegExp(`N° ${id}`) });
    await item(reg2.id).click();
    await item(reg.id).click();
    await item(reg2.id).click();
    await expect(view).toHaveAttribute("data-requested-src", urlOf(reg2.id));
    await expect(view).toHaveAttribute("data-src", urlOf(reg2.id));
    await expect(view).toHaveAttribute("data-state", "ready");

    // Export asynchrone : le worker prépare l'archive, le lien apparaît à la fin.
    await page.getByRole("button", { name: "Préparer le ZIP" }).click();
    await expect(page.getByText("Préparation… (2 badges)")).toBeVisible();
    // Rechargement pendant la preparation : le suivi du meme export reprend, sans doublon.
    await page.reload();
    await expect(page.getByText("Préparation… (2 badges)")).toBeVisible();
    const zipLink = page.getByRole("link", { name: "Télécharger le ZIP" });
    await expect(zipLink).toBeVisible({ timeout: 90_000 });
    const [download] = await Promise.all([page.waitForEvent("download"), zipLink.click()]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
    await expectLastActivity({ type: "BADGE_BATCH_EXPORTED", userId: admin.id, eventId });
    expect(await getDb().printSheetGeneration.count({ where: { eventId, output: "ZIP" } })).toBe(1);

    await page.getByRole("button", { name: "Marquer imprimés" }).click();
    await expect(toast(page, "2 badge(s) marqué(s) imprimé(s).")).toBeVisible();
    await expectLastActivity({ type: "BADGE_BATCH_PRINTED", userId: admin.id, eventId });
  });

  test("Une selection introuvable affiche un message clair", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "bdg-nosel" });
    const admin = await makeEventAdminUser({ scope: "bdg-nosel", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    for (const path of [`/event/${eventId}/badges/print`, `/event/${eventId}/badges/print?sel=expiree`]) {
      await page.goto(path);
      await expect(page.getByText("Sélection introuvable : revenez à la liste des badges.")).toBeVisible();
    }
  });

  test("Depuis la liste, « Aperçu PDF » ouvre le lot par une cle de selection, sans ids dans l'URL", async ({
    page,
    context,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "bdg-list-open" });
    const admin = await makeEventAdminUser({ scope: "bdg-list-open", eventId, orgId });
    const participant = await createTestUser({ scope: "bdg-list-open-p", verified: true, profile: true });
    const reg = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "APPROVED" });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await page.getByRole("link", { name: /badges/i }).first().click();
    await page.getByRole("checkbox").first().check();
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: /aperçu pdf/i }).click(),
    ]);
    await popup.waitForLoadState();
    expect(popup.url()).toMatch(/\/badges\/print\?sel=[0-9a-f]{32}$/);
    expect(popup.url()).not.toContain(reg.id);
    await expect(popup.getByText("1 badge(s) à imprimer")).toBeVisible();
    await expect(popup.getByRole("button", { name: new RegExp(`N° ${reg.id}`) })).toBeVisible();
  });

  test("« Tout sélectionner » prend tous les badges de la liste, au-delà d'une page, et ouvre le lot", async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000); // 130 PDF rendus par le service avant l'archive
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "bdg-all" });
    const admin = await makeEventAdminUser({ scope: "bdg-all", eventId, orgId });
    await createManyTestRegistrations({ scope: "bdg-all", eventId, categoryId, count: 130 });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await page.getByRole("link", { name: /badges/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges`));

    // La liste est paginee (10 par defaut) : on passe a 100 lignes affichees sur 130.
    await selectPageSize(page, 100);
    await expect(page.getByText("130 résultats")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(100);

    // La recherche filtre côté serveur.
    await page.getByPlaceholder(/rechercher/i).fill("Nom0042");
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    await page.getByPlaceholder(/rechercher/i).fill("");
    await expect(page.getByRole("checkbox")).toHaveCount(100);

    // Tout sélectionner : les 130, pas seulement la page affichée.
    await page.getByRole("button", { name: "Tout sélectionner (130)" }).click();
    await expect(page.getByText("130 sélectionnée(s)")).toBeVisible();
    // La sélection traverse les pages.
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page.getByRole("checkbox")).toHaveCount(30);
    await expect(page.getByRole("checkbox").first()).toBeChecked();
    await expect(page.getByText("130 sélectionnée(s)")).toBeVisible();

    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: /aperçu pdf/i }).click(),
    ]);
    await popup.waitForLoadState();
    expect(popup.url()).toMatch(/\/badges\/print\?sel=[0-9a-f]{32}$/);
    await expect(popup.getByText("130 badge(s) à imprimer")).toBeVisible();

    await popup.getByRole("button", { name: "Préparer le ZIP" }).click();
    await expect(popup.getByText("Préparation… (130 badges)")).toBeVisible({ timeout: 60_000 });
    await expect(popup.getByRole("link", { name: "Télécharger le ZIP" })).toBeVisible({ timeout: 150_000 });
    expect(await getDb().printSheetGeneration.count({ where: { eventId, output: "ZIP" } })).toBe(1);

    // Changer de filtre abandonne la sélection et le dit ; la page 2 hors résultats est ramenée.
    await page.getByLabel("Filtrer les badges").selectOption("printed");
    await expect(toast(page, "La sélection a été réinitialisée.")).toBeVisible();
    await expect(page.getByText(/aucun badge/i)).toBeVisible();
  });

  // --- Garde des pages -----------------------------------------------------

  test("Un VIEWER pur est redirige hors des pages de badge, sans voir le participant", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "bdg-viewer" });
    const viewer = await createTestEventMember({ scope: "bdg-viewer", eventId, orgId, role: "VIEWER" });
    const participant = await createTestUser({ scope: "bdg-viewer-p", verified: true, profile: true });
    const reg = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "APPROVED" });
    await loginAndEnter(page, viewer, { kind: "event", id: eventId });

    for (const path of [`/event/${eventId}/badges/print?sel=inconnue`, `/event/${eventId}/badges/${reg.id}`]) {
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
