import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestOrgMember,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

// Page Abonnement — /org/[orgId]/subscription
// Rôle mini : MANAGER (garde dans la page, AUDITOR redirige vers le dashboard).
// Page 100% lecture seule : aucune action, aucune mutation.
// Reste consultable meme quand l'abonnement est inactif (le layout la laisse passer).
test.describe("Org — Abonnement", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("OWNER voit son abonnement (plan, statut, periode, limites)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "sub-render",
      maxEvents: 5,
      maxParticipantsPerEvent: 200,
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/subscription`);
    await expect(page.getByRole("heading", { name: /^abonnement$/i })).toBeVisible();
    await expect(page.getByText("ACTIVE")).toBeVisible();
    await expect(page.getByText("Mensuel (30 jours)")).toBeVisible();
    await expect(page.getByText("Oui")).toBeVisible();
    // Limites effectives issues du plan.
    await expect(page.getByText("5").first()).toBeVisible();
    await expect(page.getByText("200").first()).toBeVisible();
  });

  test("MANAGER voit la page (role minimal)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "sub-mgr" });
    const manager = await createTestOrgMember({
      scope: "sub-mgr-user",
      orgId,
      role: "MANAGER",
    });
    await loginAs(page, manager);

    await page.goto(`/org/${orgId}/subscription`);
    await expect(page.getByRole("heading", { name: /^abonnement$/i })).toBeVisible();
  });

  test("AUDITOR est redirige vers le dashboard (garde MANAGER)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "sub-aud" });
    const auditor = await createTestOrgMember({
      scope: "sub-aud-user",
      orgId,
      role: "AUDITOR",
    });
    await loginAs(page, auditor);

    await page.goto(`/org/${orgId}/subscription`);
    await page.waitForURL(`**/org/${orgId}`);
    await expect(page.getByRole("heading", { name: /^abonnement$/i })).toHaveCount(0);
  });

  // --- Etats --------------------------------------------------------------

  test("Limites illimitees affichees comme telles", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "sub-unlimited" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/subscription`);
    await expect(page.getByText("Illimité").first()).toBeVisible();
  });

  test("Sans abonnement : alerte inactif et 'Aucun abonnement'", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "sub-none",
      activeSubscription: false,
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/subscription`);
    await expect(page.getByText("Aucun abonnement").first()).toBeVisible();
    await expect(page.getByText(/n'est pas actif/i)).toBeVisible();
  });

  test("Abonnement echu : affiche inactif", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "sub-expired" });
    await getDb().subscription.update({
      where: { orgId },
      data: { status: "EXPIRED" },
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/subscription`);
    await expect(page.getByText("EXPIRED").first()).toBeVisible();
    await expect(page.getByText(/n'est pas actif/i)).toBeVisible();
  });
});
