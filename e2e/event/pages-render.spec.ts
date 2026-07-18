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

// Tests de rendu (smoke) : pas encore couverts par une spec de navigation UI
// dediee. Un test par page -- login ADMIN, navigation, assertion d'un element
// stable (heading/texte reel du composant) pour detecter une page d'erreur.
test.describe("T-render Pages sans couverture de rendu UI", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("/event/[eventId]/activity affiche le journal d'activite", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "render-activity" });
    const admin = await makeEventAdminUser({ scope: "render-activity", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/activity`);
    await expect(
      page.getByRole("heading", { name: /journal d'activité/i }),
    ).toBeVisible();
  });

  test("/event/[eventId]/activity/[logId] affiche le detail d'une entree", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "render-activity-detail" });
    const admin = await makeEventAdminUser({ scope: "render-activity-detail", eventId, orgId });
    const log = await getDb().activityLog.create({
      data: { type: "REGISTRATION_CREATED", eventId, userId: admin.id },
    });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/activity/${log.id}`);
    // describeActivity("REGISTRATION_CREATED") => "Inscription créée" (h1).
    await expect(
      page.getByRole("heading", { name: /inscription créée/i }),
    ).toBeVisible();
  });

  test("/event/[eventId]/badges/[badgeId] affiche le detail du badge", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "render-badge-detail" });
    const admin = await makeEventAdminUser({ scope: "render-badge-detail", eventId, orgId });
    const participant = await createTestUser({
      scope: "render-badge-detail-part",
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
    // CardHead "Informations" (h3) -- statique, independant du contenu du badge.
    await expect(page.getByRole("heading", { name: /informations/i })).toBeVisible();
  });

  test("/event/[eventId]/badges/print affiche l'ecran d'impression par lot", async ({ page }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "render-badges-print" });
    const admin = await makeEventAdminUser({ scope: "render-badges-print", eventId, orgId });
    const participant = await createTestUser({
      scope: "render-badges-print-part",
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

    await page.goto(`/event/${eventId}/badges/print?ids=${reg.id}`);
    await expect(
      page.getByRole("heading", { name: /impression par lot/i }),
    ).toBeVisible();
  });

  test("/event/[eventId]/blocked-documents redirige vers l'ecran unifie des listes de blocage", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "render-blocked-docs" });
    const admin = await makeEventAdminUser({ scope: "render-blocked-docs", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/blocked-documents`);
    await page.waitForURL(new RegExp(`/event/${eventId}/blocked-emails`));
    await expect(
      page.getByRole("heading", { name: /listes de blocage/i }),
    ).toBeVisible();
  });

  test("/event/[eventId]/blocked-emails affiche les listes de blocage", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "render-blocked-emails" });
    const admin = await makeEventAdminUser({ scope: "render-blocked-emails", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/blocked-emails`);
    await expect(
      page.getByRole("heading", { name: /listes de blocage/i }),
    ).toBeVisible();
  });

  test("/event/[eventId]/categories affiche la table des categories", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "render-categories" });
    const admin = await makeEventAdminUser({ scope: "render-categories", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/categories`);
    await expect(page.getByRole("heading", { name: /catégories/i })).toBeVisible();
  });

  test("/event/[eventId]/registrations/[regId] affiche le detail de l'inscription", async ({
    page,
  }) => {
    const { orgId, eventId, categoryId } = await createTestEvent({ scope: "render-reg-detail" });
    const admin = await makeEventAdminUser({ scope: "render-reg-detail", eventId, orgId });
    const participant = await createTestUser({
      scope: "render-reg-detail-part",
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
    // CardHead "Pièces fournies" (h3) -- statique, independant du snapshot participant.
    await expect(
      page.getByRole("heading", { name: /pièces fournies/i }),
    ).toBeVisible();
  });

  test("/event/[eventId]/registrations/new affiche le formulaire d'inscription manuelle", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "render-reg-new" });
    const admin = await makeEventAdminUser({ scope: "render-reg-new", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/new`);
    await expect(
      page.getByRole("heading", { name: /inscription manuelle/i }),
    ).toBeVisible();
  });

  test("/event/[eventId]/registrations/overview affiche la vue d'ensemble agregee", async ({
    page,
  }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "render-reg-overview" });
    const admin = await makeEventAdminUser({ scope: "render-reg-overview", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/registrations/overview`);
    await expect(
      page.getByRole("heading", { name: /vue d'ensemble/i }),
    ).toBeVisible();
  });

  test("/event/[eventId]/scan affiche l'ecran scanner", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "render-scan" });
    const admin = await makeEventAdminUser({ scope: "render-scan", eventId, orgId });
    await loginAs(page, admin);

    await page.goto(`/event/${eventId}/scan`);
    await expect(page.getByRole("heading", { name: /^scanner$/i })).toBeVisible();
  });
});
