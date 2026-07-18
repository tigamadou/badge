import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

// Tests de rendu simples (pas de spec de navigation UI dediee) : login avec le
// role attendu, navigation vers la page, assertion d'un heading reel lu dans le
// composant source. Pas d'assertion metier fine ici (couverte par les autres
// specs org/*.spec.ts) -- uniquement "la page rend sans planter et affiche son
// titre attendu".
test.describe("Org pages render", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("OWNER voit /org/[orgId]/activity", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "render-activity" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/activity`);
    // src/app/org/[orgId]/activity/page.tsx
    await expect(
      page.getByRole("heading", { name: /journal d.activité/i }),
    ).toBeVisible();
  });

  test("OWNER voit /org/[orgId]/activity/[logId]", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "render-activity-detail" });
    await loginAs(page, owner);

    const db = getDb();
    const log = await db.activityLog.create({
      data: {
        type: "ORG_UPDATED",
        userId: owner.id,
        orgId,
        details: { changedFields: ["name"] },
      },
    });

    await page.goto(`/org/${orgId}/activity/${log.id}`);
    // src/components/activity/JournalEntryDetail.tsx : h1 = describeActivity(log.type)
    // -> "Organisation modifiée" pour ORG_UPDATED (src/lib/activity-labels.ts).
    await expect(
      page.getByRole("heading", { name: /organisation modifiée/i }),
    ).toBeVisible();
  });

  test("OWNER voit /org/[orgId]/members", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "render-members" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/members`);
    // src/app/org/[orgId]/members/MembersClient.tsx
    await expect(page.getByRole("heading", { name: /^membres$/i })).toBeVisible();
  });

  test("OWNER voit /org/[orgId]/settings", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "render-settings" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/settings`);
    // src/app/org/[orgId]/settings/SettingsClient.tsx
    await expect(
      page.getByRole("heading", { name: /paramètres de l.organisation/i }),
    ).toBeVisible();
  });

  test("OWNER voit /org/[orgId]/settings/badge", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "render-settings-badge" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/settings/badge`);
    // src/app/org/[orgId]/settings/badge/page.tsx
    await expect(page.getByRole("heading", { name: /modèle de badge/i })).toBeVisible();
  });

  test("OWNER voit /org/[orgId]/subscription", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "render-subscription" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/subscription`);
    // src/app/org/[orgId]/subscription/page.tsx
    await expect(page.getByRole("heading", { name: /^abonnement$/i })).toBeVisible();
  });

  test("user membre de 2 orgs voit /select lister ses orgs", async ({ page }) => {
    const { orgId: orgIdA, owner: user } = await createTestOrgWithOwner({ scope: "render-select-a" });
    const { orgId: orgIdB } = await createTestOrgWithOwner({ scope: "render-select-b" });
    const db = getDb();
    // /select redirige directement si un seul workspace accessible : on rattache
    // le meme user comme MANAGER de la deuxieme org pour forcer l'affichage
    // effectif du selecteur (2 targets).
    await db.orgMembership.create({
      data: { userId: user.id, orgId: orgIdB, role: "MANAGER" },
    });

    await loginAs(page, user);

    await page.goto("/select");
    // src/app/select/page.tsx
    await expect(
      page.getByRole("heading", { name: /choisissez un espace/i }),
    ).toBeVisible();

    const org = await db.organization.findUnique({ where: { id: orgIdA }, select: { name: true } });
    await expect(page.getByText(org!.name)).toBeVisible();
  });

  test("participant sans profil voit /account/profile/complete", async ({ page }) => {
    const user = await createTestUser({ scope: "render-profile-complete", verified: true });
    await loginAs(page, user);

    await page.goto("/account/profile/complete");
    // src/app/account/profile/complete/page.tsx
    await expect(
      page.getByRole("heading", { name: /compléter votre profil/i }),
    ).toBeVisible();
  });
});
