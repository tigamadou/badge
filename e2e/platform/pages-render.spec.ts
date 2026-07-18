import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";

// Tests de RENDU (pas de navigation UI spec) : 1 test par page /platform/...
// sans couverture existante. Chaque test se logge en staff, navigue en direct
// (page.goto) et asserte un heading STABLE lu dans le composant page.tsx
// correspondant (cf. src/app/platform/...). Pas d'assertion sur le contenu
// dynamique fragile (dates, ids generes) au-dela du strict necessaire.
test.describe("Staff > pages platform (rendu)", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("/platform/activity/[logId] affiche le libelle de l'action", async ({ page }) => {
    const observer = await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "render-activity-detail" });
    const { orgId } = await createTestOrgWithOwner({ scope: "render-activity-detail" });

    // ORG_CREATED est mappe sur le libelle FR "Organisation créée" (lib/activity-labels.ts).
    const log = await getDb().activityLog.create({
      data: { type: "ORG_CREATED", userId: observer.id, orgId },
    });

    await page.goto(`/platform/activity/${log.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Organisation créée" })).toBeVisible();
  });

  test("/platform/organizations/[orgId]/activity affiche le journal de l'org", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "render-org-activity" });
    const { orgId } = await createTestOrgWithOwner({ scope: "render-org-activity" });

    await page.goto(`/platform/organizations/${orgId}/activity`);
    await expect(
      page.getByRole("heading", { level: 2, name: "Journal d'activité (50 dernières entrées)" }),
    ).toBeVisible();
  });

  test("/platform/organizations/[orgId]/events affiche la liste des evenements", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "render-org-events" });
    // Org fraiche sans event : compteur deterministe (0).
    const { orgId } = await createTestOrgWithOwner({ scope: "render-org-events" });

    await page.goto(`/platform/organizations/${orgId}/events`);
    await expect(page.getByRole("heading", { level: 2, name: "Événements (0)" })).toBeVisible();
  });

  test("/platform/organizations/[orgId]/members affiche la liste des membres", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "render-org-members" });
    // Org fraiche : un seul membre (le OWNER cree par createTestOrgWithOwner).
    const { orgId } = await createTestOrgWithOwner({ scope: "render-org-members" });

    await page.goto(`/platform/organizations/${orgId}/members`);
    await expect(page.getByRole("heading", { level: 2, name: "Membres (1)" })).toBeVisible();
  });

  test("/platform/organizations/[orgId]/subscription affiche le formulaire d'abonnement", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "render-org-subscription" });
    const { orgId } = await createTestOrgWithOwner({ scope: "render-org-subscription" });
    // Un plan au catalogue : etat realiste pour le formulaire d'assignation d'abonnement.
    await getDb().plan.create({ data: { name: `E2E Plan render-${Date.now()}` } });

    await page.goto(`/platform/organizations/${orgId}/subscription`);
    // La page a 2 h1 (nom de l'org via le layout + "Abonnement — <org>" via la page).
    // On cible celui de la page par son prefixe, sans dependre du nom exact de l'org.
    await expect(
      page.getByRole("heading", { level: 1, name: /^Abonnement/ }),
    ).toBeVisible();
  });

  test("/platform/plans affiche le catalogue des plans", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "render-plans" });

    await page.goto("/platform/plans");
    await expect(page.getByRole("heading", { level: 1, name: "Plans" })).toBeVisible();
  });

  test("/platform/settings affiche les parametres plateforme", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "render-settings" });

    await page.goto("/platform/settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Paramètres plateforme" }),
    ).toBeVisible();
  });

  test("/platform/settings/badge affiche le picker de template", async ({ page }) => {
    // Page reservee STAFF_ADMIN minimum (redirige sinon) : cf. src/app/platform/settings/badge/page.tsx.
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "render-settings-badge" });

    await page.goto("/platform/settings/badge");
    await expect(
      page.getByRole("heading", { level: 1, name: "Template de badge par defaut" }),
    ).toBeVisible();
  });

  test("/platform/users affiche la liste des utilisateurs", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "render-users" });

    await page.goto("/platform/users");
    await expect(page.getByRole("heading", { level: 1, name: "Utilisateurs" })).toBeVisible();
  });

  test("/platform/users/[userId] affiche la fiche utilisateur", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "render-user-detail" });
    const target = await createTestUser({ scope: "render-user-detail-target", verified: true });

    await page.goto(`/platform/users/${target.id}`);
    await expect(page.getByRole("heading", { level: 1, name: target.name })).toBeVisible();
  });

  test("/platform/users/new affiche le formulaire de creation", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "render-user-new" });

    await page.goto("/platform/users/new");
    await expect(page.getByRole("heading", { level: 1, name: "Nouvel utilisateur" })).toBeVisible();
  });
});
