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
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

// T-interactions : interactions UI PRIMAIRES non couvertes ailleurs (les specs
// event/*.spec.ts voisines testent surtout via API + audit). Ici on clique
// reellement les boutons/formulaires et on asserte l'effet (BDD, audit ou
// feedback UI), sans refaire le rendu (deja couvert par pages-render.spec.ts).
test.describe("T-interactions Event UI (clics reels + effet)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("Categories : creation via la modale UI -> apparait dans la table + audit", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "cat-modal-create" });
    const admin = await makeEventAdminUser({ scope: "cat-modal-create", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/categories`);
    await page.getByRole("button", { name: /ajouter/i }).click();
    await expect(page.getByRole("heading", { name: /nouvelle catégorie/i })).toBeVisible();

    const catName = `Presse UI ${Date.now()}`;
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill(catName);
    await page.getByLabel("Numéro").fill("77");
    await page.getByRole("button", { name: "Créer", exact: true }).click();

    // La modale se ferme et la table se rafraichit avec la nouvelle categorie.
    await expect(page.getByRole("heading", { name: /nouvelle catégorie/i })).toBeHidden();
    await expect(page.getByText(catName)).toBeVisible();

    const db = getDb();
    const created = await db.category.findFirst({ where: { eventId, name: catName } });
    expect(created).not.toBeNull();
    expect(created?.number).toBe(77);

    await expectLastActivity({
      type: "CATEGORY_CREATED",
      userId: admin.id,
      eventId,
      targetId: created!.id,
    });
  });

  test("Categories : etat vide affiche 'Aucune catégorie'", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "cat-empty" });
    const admin = await makeEventAdminUser({ scope: "cat-empty", eventId, orgId });
    // Retire la categorie par defaut (sans inscription liee) pour obtenir l'etat vide.
    await getDb().category.delete({ where: { id: categoryId } });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/categories`);
    await expect(page.getByText(/aucune catégorie/i)).toBeVisible();
  });

  test("Registrations/new : soumission du formulaire UI -> registration creee (APPROVED)", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "reg-new-ui" });
    const admin = await makeEventAdminUser({ scope: "reg-new-ui", eventId, orgId });
    // Le POST /registrations resout le user par email et ignore les champs texte
    // du formulaire (snapshot pris depuis le profil existant) -- il faut donc un
    // user verifie au profil complet.
    const participant = await createTestUser({
      scope: "reg-new-ui-part",
      verified: true,
      profile: true,
    });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/new`);
    await expect(page.getByRole("heading", { name: /inscription manuelle/i })).toBeVisible();

    await page.getByLabel("Prénom").fill("Ignoré");
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Ignoré");
    await page.getByLabel("Adresse e-mail").fill(participant.email);
    await page.getByLabel("Structure / organisation").fill("Structure UI");
    await page.getByLabel("Numéro de pièce").fill("UI-DOC-001");
    // La categorie par defaut de l'event est deja selectionnee (RadioCards value initial).

    await page.getByRole("button", { name: /créer l'inscription/i }).click();

    // Redirection vers le detail de la registration creee. Le lookahead (?!new$) evite de
    // matcher l'URL de depart /registrations/new (qui passerait la regex instantanement).
    await page.waitForURL(new RegExp(`/event/${eventId}/registrations/(?!new$)[A-Za-z0-9-]+$`), {
      timeout: 8000,
    });

    // La registration creee est identifiee par le regId de l'URL de detail (l'inscription
    // manuelle n'est pas necessairement rattachee a un userId : le snapshot vient du formulaire).
    const regId = page.url().split("/registrations/")[1];
    const db = getDb();
    const created = await db.registration.findUnique({ where: { id: regId } });
    expect(created).not.toBeNull();
    expect(created?.eventId).toBe(eventId);
    expect(created?.snapshotEmail).toBe(participant.email);

    await expectLastActivity({
      type: "REGISTRATION_CREATED",
      userId: admin.id,
      eventId,
      targetId: created!.id,
    });
  });

  test("Scan : saisie manuelle d'un code valide -> 'Accès autorisé' affiché", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "scan-manual-ok" });
    const operator = await createTestEventMember({
      scope: "scan-manual-ok",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    const participant = await createTestUser({
      scope: "scan-manual-ok-part",
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

  test("Scan : saisie manuelle d'un code rejeté -> 'Accès refusé' affiché", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "scan-manual-rej" });
    const operator = await createTestEventMember({
      scope: "scan-manual-rej",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    const participant = await createTestUser({
      scope: "scan-manual-rej-part",
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

  test("Blocked emails : ajout puis retrait via l'UI + audit", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "blocked-email-ui" });
    const admin = await makeEventAdminUser({ scope: "blocked-email-ui", eventId, orgId });
    await loginAs(page, admin);
    page.on("dialog", (d) => d.accept());

    const email = `blocked-ui-${Date.now()}@v2-11-e2e.test`;

    await page.goto(`/event/${eventId}/blocked-emails`);
    await page.getByLabel(/e-mail à bloquer/i).fill(email);
    await page.getByRole("button", { name: /^bloquer$/i }).click();

    await expect(page.getByText(email)).toBeVisible();

    const db = getDb();
    const blocked = await db.blockedEmail.findUnique({
      where: { eventId_email: { eventId, email } },
    });
    expect(blocked).not.toBeNull();

    const addedLog = await expectLastActivity({
      type: "REGISTRATION_UPDATED",
      userId: admin.id,
      eventId,
    });
    expect((addedLog.details as { action?: string })?.action).toBe("blocked-email-added");

    // Retrait via le bouton "Retirer" (confirm() auto-accepte via le handler dialog).
    await page.getByRole("button", { name: /retirer/i }).click();
    await expect(page.getByText(email)).toBeHidden();

    const gone = await db.blockedEmail.findUnique({
      where: { eventId_email: { eventId, email } },
    });
    expect(gone).toBeNull();

    const removedLog = await expectLastActivity({
      type: "REGISTRATION_UPDATED",
      userId: admin.id,
      eventId,
    });
    expect((removedLog.details as { action?: string })?.action).toBe("blocked-email-removed");
  });

  test("Blocked documents : ajout puis retrait via l'UI + audit", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "blocked-doc-ui" });
    const admin = await makeEventAdminUser({ scope: "blocked-doc-ui", eventId, orgId });
    await loginAs(page, admin);
    page.on("dialog", (d) => d.accept());

    const docNumber = `UI-DOC-${Date.now()}`;

    await page.goto(`/event/${eventId}/blocked-emails`);
    await page.getByRole("tab", { name: /documents/i }).click();
    await page.getByLabel(/numéro de pièce à bloquer/i).fill(docNumber);
    await page.getByRole("button", { name: /^bloquer$/i }).click();

    await expect(page.getByText(docNumber)).toBeVisible();

    const db = getDb();
    const blocked = await db.blockedDocument.findUnique({
      where: { eventId_documentNumber: { eventId, documentNumber: docNumber } },
    });
    expect(blocked).not.toBeNull();

    const addedLog = await expectLastActivity({
      type: "REGISTRATION_UPDATED",
      userId: admin.id,
      eventId,
    });
    expect((addedLog.details as { action?: string })?.action).toBe("blocked-document-added");

    await page.getByRole("button", { name: /retirer/i }).click();
    await expect(page.getByText(docNumber)).toBeHidden();

    const gone = await db.blockedDocument.findUnique({
      where: { eventId_documentNumber: { eventId, documentNumber: docNumber } },
    });
    expect(gone).toBeNull();

    const removedLog = await expectLastActivity({
      type: "REGISTRATION_UPDATED",
      userId: admin.id,
      eventId,
    });
    expect((removedLog.details as { action?: string })?.action).toBe("blocked-document-removed");
  });

  test("Registrations list : filtre par statut via l'UI", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "reg-list-filter" });
    const admin = await makeEventAdminUser({ scope: "reg-list-filter", eventId, orgId });
    const pending = await createTestUser({ scope: "reg-list-filter-pending", verified: true, profile: true });
    const approved = await createTestUser({ scope: "reg-list-filter-approved", verified: true, profile: true });
    await createTestRegistration({ eventId, userId: pending.id, categoryId, status: "PENDING" });
    await createTestRegistration({ eventId, userId: approved.id, categoryId, status: "APPROVED" });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations`);
    // Les deux inscriptions sont visibles sans filtre (statuts confondus).
    await expect(page.getByRole("cell", { name: /en attente/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /^validé$/i })).toBeVisible();

    // Filtre sur "Approuvé" : la ligne PENDING disparait.
    await page.locator("select").selectOption("APPROVED");
    await expect(page.getByRole("cell", { name: /^validé$/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /en attente/i })).toBeHidden();
  });

  test("Registrations list : etat vide affiche 'Aucune inscription'", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "reg-list-empty" });
    const admin = await makeEventAdminUser({ scope: "reg-list-empty", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations`);
    await expect(page.getByText(/aucune inscription/i)).toBeVisible();
  });

  test("Registration detail : approbation via le bouton UI -> statut Validé + audit", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "reg-detail-approve-ui" });
    const admin = await makeEventAdminUser({ scope: "reg-detail-approve-ui", eventId, orgId });
    const participant = await createTestUser({
      scope: "reg-detail-approve-ui-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "PENDING",
    });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await page.getByRole("button", { name: /approuver/i }).click();

    await expect(page.getByText(/^validé$/i)).toBeVisible();

    const db = getDb();
    const updated = await db.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.status).toBe("APPROVED");

    await expectLastActivity({
      type: "REGISTRATION_APPROVED",
      userId: admin.id,
      eventId,
      targetId: reg.id,
    });
  });

  test("Registration detail : rejet via la modale UI (motif) -> statut Rejeté + audit", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "reg-detail-reject-ui" });
    const admin = await makeEventAdminUser({ scope: "reg-detail-reject-ui", eventId, orgId });
    const participant = await createTestUser({
      scope: "reg-detail-reject-ui-part",
      verified: true,
      profile: true,
    });
    const reg = await createTestRegistration({
      eventId,
      userId: participant.id,
      categoryId,
      status: "PENDING",
    });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/${reg.id}`);
    await page.getByRole("button", { name: /rejeter \/ bloquer/i }).click();
    await expect(page.getByRole("heading", { name: /rejeter cette inscription/i })).toBeVisible();

    await page.getByPlaceholder(/motif \(obligatoire\)/i).fill("Document illisible UI");
    await page.getByRole("button", { name: "Rejeter", exact: true }).click();

    await expect(page.getByText(/^rejeté$/i)).toBeVisible();
    await expect(page.getByText(/motif de rejet : document illisible ui/i)).toBeVisible();

    const db = getDb();
    const updated = await db.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.status).toBe("REJECTED");
    expect(updated?.rejectionReason).toBe("Document illisible UI");

    await expectLastActivity({
      type: "REGISTRATION_REJECTED",
      userId: admin.id,
      eventId,
      targetId: reg.id,
    });
  });

  test("Badges : selection + 'Marquer imprimés' depuis la liste UI -> badgePrinted + audit lot", async ({
    page,
  }) => {
    // Note : /event/[eventId]/badges/print n'est qu'un apercu PDF (pas de bouton
    // d'action) -- l'impression par lot reelle se declenche depuis la liste
    // /event/[eventId]/badges (BadgeListTable, bouton "Marquer imprimés").
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "badges-print-ui" });
    const admin = await makeEventAdminUser({ scope: "badges-print-ui", eventId, orgId });
    const p1 = await createTestUser({ scope: "badges-print-ui-p1", verified: true, profile: true });
    const p2 = await createTestUser({ scope: "badges-print-ui-p2", verified: true, profile: true });
    const reg1 = await createTestRegistration({ eventId, userId: p1.id, categoryId, status: "APPROVED" });
    const reg2 = await createTestRegistration({ eventId, userId: p2.id, categoryId, status: "APPROVED" });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/badges`);
    // Filtre par defaut "Non imprimés" : les 2 badges doivent apparaitre.
    const checkboxes = page.getByRole("checkbox");
    await expect(checkboxes).toHaveCount(2);
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();

    await page.getByRole("button", { name: /marquer imprimés/i }).click();

    // Le filtre "Non imprimés" exclut desormais les 2 badges marques.
    await expect(page.getByText(/aucun badge/i)).toBeVisible();

    const db = getDb();
    const printedCount = await db.registration.count({
      where: { id: { in: [reg1.id, reg2.id] }, badgePrinted: true },
    });
    expect(printedCount).toBe(2);

    const log = await expectLastActivity({
      type: "BADGE_BATCH_PRINTED",
      userId: admin.id,
      eventId,
    });
    expect((log.details as { count?: number })?.count).toBe(2);
  });
});
