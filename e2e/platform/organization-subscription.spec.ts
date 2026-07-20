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

  async function seedPlan(scope: string) {
    return getDb().plan.create({
      data: {
        name: `e2e-plan-${scope}-${Date.now()}`,
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
    await expect(page.getByLabel("Période")).toBeVisible();
    await expect(page.getByLabel("Statut")).toBeVisible();
  });

  test("Organisation introuvable -> 404", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "psub-404" });

    const res = await page.goto("/platform/organizations/inexistant-e2e/subscription");
    expect(res?.status()).toBe(404);
  });

  // --- Actions UI ---------------------------------------------------------

  test("STAFF_ADMIN reassigne un plan avec periode annuelle", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "psub-assign" });
    const plan = await seedPlan("psub-assign");
    const staff = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "psub-assign-staff" });

    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await page.getByLabel("Plan").selectOption(plan.id);
    await page.getByLabel("Période").selectOption("ANNUAL");
    await page.getByLabel("Statut").selectOption("ACTIVE");
    await page.getByRole("button", { name: /enregistrer/i }).click();

    await expect(async () => {
      const sub = await getDb().subscription.findUnique({ where: { orgId } });
      expect(sub?.planId).toBe(plan.id);
      expect(sub?.period).toBe("ANNUAL");
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
    await page.getByLabel("Période").selectOption("MONTHLY");
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
    await page.getByLabel("Période").selectOption("MONTHLY");
    await page.getByLabel("Statut").selectOption("EXPIRED");
    await page.getByRole("button", { name: /enregistrer/i }).click();

    await expect(async () => {
      const sub = await getDb().subscription.findUnique({ where: { orgId } });
      expect(sub?.status).toBe("EXPIRED");
    }).toPass();
  });

  // --- Gardes & API -------------------------------------------------------

  test("STAFF_OBSERVER -> 403 sur l'assignation", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "psub-observer" });
    const plan = await seedPlan("psub-observer");
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "psub-observer-staff" });

    const res = await page.request.put(`/api/platform/organizations/${orgId}/subscription`, {
      data: { planId: plan.id, status: "ACTIVE", period: "MONTHLY" },
    });
    expect(res.status()).toBe(403);
  });

  test("Plan inexistant -> 404", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "psub-noplan" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "psub-noplan-staff" });

    const res = await page.request.put(`/api/platform/organizations/${orgId}/subscription`, {
      data: { planId: "plan-inexistant", status: "ACTIVE", period: "MONTHLY" },
    });
    expect(res.status()).toBe(404);
  });
});
