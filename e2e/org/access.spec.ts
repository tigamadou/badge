import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestOrgMember,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs, loginAsStaff } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

// Acces a l'espace organisation — gates du layout /org/[orgId]
// Residu transverse apres la reorganisation par page : tout ce qui ne porte pas
// sur une page precise mais sur l'entree dans l'espace.
test.describe("Org — Acces a l'espace", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("Non connecte -> redirige vers /login avec callbackUrl", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "acc-anon" });

    await page.goto(`/org/${orgId}`);
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain(`callbackUrl=`);
  });

  test("Organisation introuvable -> 404", async ({ page }) => {
    const { owner } = await createTestOrgWithOwner({ scope: "acc-404" });
    await loginAs(page, owner);

    const res = await page.goto("/org/org-inexistant-e2e");
    expect(res?.status()).toBe(404);
  });

  test("Membre d'une autre org -> sorti de l'espace convoite", async ({ page }) => {
    const { orgId: otherOrgId } = await createTestOrgWithOwner({ scope: "acc-other" });
    const { orgId: myOrgId, owner } = await createTestOrgWithOwner({ scope: "acc-mine" });
    await loginAs(page, owner);

    // Le layout renvoie vers /select, qui redirige aussitot vers l'unique
    // workspace accessible : on atterrit donc sur SA propre org, jamais sur
    // celle qu'on tentait d'ouvrir.
    await page.goto(`/org/${otherOrgId}`);
    await page.waitForURL(`**/org/${myOrgId}`);
    expect(page.url()).not.toContain(otherOrgId);
  });

  test("Utilisateur sans aucune org -> redirige hors de l'espace", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "acc-nomember" });
    const outsider = await createTestUser({ scope: "acc-outsider", verified: true });
    await loginAs(page, outsider);

    await page.goto(`/org/${orgId}`);
    await expect(page).not.toHaveURL(new RegExp(`/org/${orgId}$`));
  });

  test("Staff sans OrgMembership -> redirige vers la vue plateforme, et agit avec staffActor", async ({
    page,
  }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "acc-staff" });
    const staff = await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "acc-staff-user" });

    // v4 : le staff ne descend plus dans /org, il supervise via /platform.
    await page.goto(`/org/${orgId}`);
    await page.waitForURL(new RegExp(`/platform/organizations/${orgId}`), { timeout: 8000 });

    // Mais il peut muter l'org : l'audit porte staffActor=true.
    const newName = "E2E Org via staff";
    const res = await page.request.patch(`/api/org/${orgId}`, { data: { name: newName } });
    expect(res.status()).toBe(200);

    const org = await getDb().organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    expect(org?.name).toBe(newName);

    await expectLastActivity({
      type: "ORG_UPDATED",
      orgId,
      userId: staff.id,
      staffActor: true,
    });
  });

  test("La nav est filtree par role (AUDITOR ne voit ni Membres ni Parametres)", async ({
    page,
  }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "acc-nav" });
    const auditor = await createTestOrgMember({
      scope: "acc-nav-user",
      orgId,
      role: "AUDITOR",
    });
    await loginAs(page, auditor);

    await page.goto(`/org/${orgId}`);
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: /tableau de bord/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^membres$/i })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /^paramètres$/i })).toHaveCount(0);
  });

  test("MANAGER et AUDITOR peuvent lire l'org (GET /api/org/[orgId] -> 200)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "acc-read" });
    const manager = await createTestOrgMember({
      scope: "acc-read-mgr",
      orgId,
      role: "MANAGER",
    });
    await loginAs(page, manager);
    expect((await page.request.get(`/api/org/${orgId}`)).status()).toBe(200);

    const auditor = await createTestOrgMember({
      scope: "acc-read-aud",
      orgId,
      role: "AUDITOR",
    });
    await loginAs(page, auditor);
    expect((await page.request.get(`/api/org/${orgId}`)).status()).toBe(200);
  });
});
