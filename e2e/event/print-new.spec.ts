import { test, expect, type Page } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestPrintProduct,
  createTestPrintRequest,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
  makeEventAdminUser,
  pinTestEventTemplate,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { expectLastActivity } from "../helpers/audit";
import { toast } from "../helpers/feedback";

// Inscriptions APPROVED d'un évènement, une par participant E2E.
async function approvedRegistrations(eventId: string, categoryId: string, scope: string, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const user = await createTestUser({ scope: `${scope}-${i}`, verified: true, profile: true });
    ids.push((await createTestRegistration({ eventId, userId: user.id, categoryId, status: "APPROVED" })).id);
  }
  return ids;
}

// Du menu à l'étape 1 de l'assistant : liste, « Nouvelle demande », type, « Continuer ».
async function startAdvanceDraft(page: Page, eventId: string) {
  await page.getByRole("link", { name: "Impression", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print$`));
  await page.getByRole("link", { name: "Nouvelle demande" }).click();
  await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print/new$`));
  await page.getByRole("radio", { name: /En amont/ }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print/[^/]+/edit$`));
}

// Page Nouvelle demande d'impression — /event/[eventId]/print/new, puis l'assistant en 6 étapes
// sur /print/[requestId]/edit (type, badges, support, accessoires, remise, récapitulatif).
// Rôle : permission `print.request` (ADMIN de l'évènement ou OWNER/MANAGER de l'organisation).
test.describe("Event — Nouvelle demande d'impression", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN crée une demande en amont (tous les badges, support, cordon, retrait) et l'envoie", async ({ page }) => {
    const stamp = Date.now();
    const badgeName = `Support PVC E2E ${stamp}`;
    const lanyardName = `Cordon E2E ${stamp}`;
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "print-new-flow" });
    const admin = await makeEventAdminUser({ scope: "print-new-flow", eventId, orgId });
    await pinTestEventTemplate({ eventId, installedById: admin.id });
    const registrationIds = await approvedRegistrations(eventId, categoryId, "print-new-flow", 3);
    await createTestPrintProduct({ name: badgeName, kind: "BADGE", published: true });
    await createTestPrintProduct({ name: lanyardName, kind: "ACCESSORY", published: true });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    // Étape « Type » : « Continuer » reste désactivé tant qu'aucun type n'est choisi.
    await page.getByRole("link", { name: "Impression", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print$`));
    await page.getByRole("link", { name: "Nouvelle demande" }).click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print/new$`));
    await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
    await page.getByRole("radio", { name: /En amont/ }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print/[^/]+/edit$`));
    const requestId = page.url().match(/\/print\/([^/]+)\/edit$/)![1];

    // Succès : le brouillon existe, sans réservation.
    const draft = await getDb().printRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(draft.status).toBe("DRAFT");
    expect(draft.type).toBe("ADVANCE");
    expect(draft.eventId).toBe(eventId);

    // Étape « Badges » : tous les badges disponibles.
    await expect(page.getByText("3 badges sélectionnés")).toBeVisible();
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect.poll(() => getDb().printRequestItem.count({ where: { requestId } })).toBe(3);

    // Étape « Support ».
    await page.getByRole("button", { name: new RegExp(badgeName) }).click();
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect
      .poll(() => getDb().printQuoteLine.count({ where: { requestId, label: badgeName, removedAt: null } }))
      .toBe(1);

    // Étape « Accessoires » : un cordon.
    await page.getByRole("button", { name: new RegExp(lanyardName) }).click();
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect
      .poll(() => getDb().printQuoteLine.count({ where: { requestId, label: lanyardName, removedAt: null } }))
      .toBe(1);

    // Étape « Remise » : retrait.
    await page.getByRole("radio", { name: /^Retrait/ }).click();
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect
      .poll(async () => (await getDb().printRequest.findUniqueOrThrow({ where: { id: requestId } })).delivery)
      .toBe("PICKUP");

    // Récapitulatif : les deux lignes puis l'envoi.
    await expect(page.getByRole("cell", { name: badgeName })).toBeVisible();
    await expect(page.getByRole("cell", { name: lanyardName })).toBeVisible();
    await expect(page.getByText("Le prix définitif est fixé par l'équipe Badge dans le devis.")).toBeVisible();
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(toast(page, "Demande envoyée.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print/${requestId}$`));

    // Effet persistant : demande envoyée, trois badges réservés, trace d'audit.
    const sent = await getDb().printRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(sent.status).toBe("SUBMITTED");
    expect(sent.submittedAt).not.toBeNull();
    const items = await getDb().printRequestItem.findMany({ where: { requestId } });
    expect(items.map((i) => i.registrationId).sort()).toEqual([...registrationIds].sort());
    await expectLastActivity({ type: "PRINT_REQUEST_SUBMITTED", eventId, userId: admin.id, targetId: requestId });

    // La liste montre la demande « Envoyée ».
    await page.getByRole("link", { name: "Impression", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print$`));
    await expect(page.locator("tr", { hasText: sent.reference })).toContainText("Envoyée");
  });

  test("Une deuxième demande ne propose pas les inscriptions déjà demandées", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "print-new-reserved" });
    const admin = await makeEventAdminUser({ scope: "print-new-reserved", eventId, orgId });
    const [first, second, third, free] = await approvedRegistrations(eventId, categoryId, "print-new-reserved", 4);
    const earlier = await createTestPrintRequest({
      eventId,
      orgId,
      createdById: admin.id,
      status: "SUBMITTED",
      registrationIds: [first, second, third],
    });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await startAdvanceDraft(page, eventId);
    const requestId = page.url().match(/\/print\/([^/]+)\/edit$/)![1];

    // Sélection manuelle : trois lignes grisées « Déjà dans … », une seule case à cocher.
    await page.getByRole("radio", { name: /Sélection manuelle/ }).click();
    await expect(page.getByText(`Déjà dans ${earlier.reference}`)).toHaveCount(3);
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    await expect(page.getByText("0 badge sélectionné")).toBeVisible();

    // Échec attendu : rien de sélectionné, l'étape reste affichée et aucun badge n'est enregistré.
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect(toast(page, "Sélectionnez au moins un badge.")).toBeVisible();
    await expect(page.getByRole("radio", { name: /Sélection manuelle/ })).toBeVisible();
    expect(await getDb().printRequestItem.count({ where: { requestId } })).toBe(0);

    // La seule inscription libre se coche, puis s'enregistre.
    await page.getByRole("checkbox").check();
    await expect(page.getByText("1 badge sélectionné")).toBeVisible();
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect
      .poll(async () => (await getDb().printRequestItem.findMany({ where: { requestId } })).map((i) => i.registrationId))
      .toEqual([free]);
  });
});
