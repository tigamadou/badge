import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

// Page Abonnement d'une org — /platform/organizations/[orgId]/subscription
// Rôle : STAFF_ADMIN. Le formulaire pilote plan + statut + PERIODE + overrides ;
// startDate/endDate sont calcules cote serveur depuis la periode.
test.describe("Platform — Abonnement d'une organisation", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function seedPlan(scope: string, period: "MONTHLY" | "ANNUAL" = "MONTHLY") {
    return getDb().plan.create({
      data: {
        name: `e2e-plan-${scope}-${Date.now()}`,
        period,
        maxEvents: 5,
        maxParticipantsPerEvent: 100,
      },
    });
  }

  // --- Acces & rendu ------------------------------------------------------

  test("STAFF_ADMIN voit le formulaire d'abonnement", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "psub-render" });
    await seedPlan("psub-render");
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "psub-render-staff" });

    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await expect(page.getByLabel("Plan")).toBeVisible();
    // La periode n'est plus saisie : elle est portee par le plan et affichee en lecture seule.
    await expect(page.getByText("Période")).toBeVisible();
    await expect(page.getByLabel("Statut")).toBeVisible();
  });

  test("Organisation introuvable -> 404", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "psub-404" });

    const res = await page.goto("/platform/organizations/inexistant-e2e/subscription");
    expect(res?.status()).toBe(404);
  });

  // --- Actions UI ---------------------------------------------------------

  test("STAFF_ADMIN assigne un plan annuel : dates calculees sur 365j", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "psub-assign" });
    const plan = await seedPlan("psub-assign", "ANNUAL");
    const staff = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "psub-assign-staff" });

    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await page.getByLabel("Plan").selectOption(plan.id);
    await page.getByLabel("Statut").selectOption("ACTIVE");
    await page.getByRole("button", { name: /enregistrer/i }).click();

    await expect(async () => {
      const sub = await getDb().subscription.findUnique({ where: { orgId } });
      expect(sub?.planId).toBe(plan.id);
      // La periode vient du plan (ANNUAL) -> endDate a +365j.
      expect(
        Math.round((sub!.endDate!.getTime() - sub!.startDate.getTime()) / 86_400_000),
      ).toBe(365);
    }).toPass();

    await expectLastActivity({ type: "SUBSCRIPTION_UPDATED", orgId, userId: staff.id });
  });

  test("STAFF_ADMIN applique des overrides de limites", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "psub-override" });
    const plan = await seedPlan("psub-override");
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "psub-override-staff" });

    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await page.getByLabel("Plan").selectOption(plan.id);
    await page.getByLabel(/override max events/i).fill("42");
    await page.getByRole("button", { name: /enregistrer/i }).click();

    await expect(async () => {
      const sub = await getDb().subscription.findUnique({ where: { orgId } });
      expect(sub?.overrideMaxEvents).toBe(42);
    }).toPass();
  });

  test("Passer le statut a EXPIRED rend l'abonnement inactif", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "psub-expire" });
    const plan = await seedPlan("psub-expire");
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "psub-expire-staff" });

    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await page.getByLabel("Plan").selectOption(plan.id);
    await page.getByLabel("Statut").selectOption("EXPIRED");
    await page.getByRole("button", { name: /enregistrer/i }).click();

    await expect(async () => {
      const sub = await getDb().subscription.findUnique({ where: { orgId } });
      expect(sub?.status).toBe("EXPIRED");
    }).toPass();
  });

  // --- Gardes & API -------------------------------------------------------

});
