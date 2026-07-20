import { test, expect } from "@playwright/test";
import {
  createTestStaff,
  createTestOrgWithOwner,
  getDb,
  cleanupE2ETestData,
  disconnectDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

test.describe("Parcours abonnement org", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("creation org : slug genere en direct et en lecture seule", async ({ page }) => {
    const staff = await createTestStaff({ scope: "slug-live", role: "STAFF_ADMIN" });
    await loginAs(page, staff);

    await page.goto("/platform/organizations/new");
    const slugField = page.getByLabel(/Slug/);

    // Le slug suit le nom en direct.
    await page.getByLabel("Nom de l'organisation").fill("Salon Emploi E2E");
    await expect(slugField).toHaveValue("salon-emploi-e2e");

    // Accents et ponctuation normalises.
    await page.getByLabel("Nom de l'organisation").fill("Évènement Été !!");
    await expect(slugField).toHaveValue("evenement-ete");

    // Lecture seule : non editable.
    await expect(slugField).toHaveAttribute("readonly", "");
  });

  test("attribution d'un plan mensuel : endDate calculee a +30 jours", async ({ page }) => {
    const staff = await createTestStaff({ scope: "sub-assign", role: "STAFF_ADMIN" });
    const { orgId } = await createTestOrgWithOwner({ scope: "sub-assign" });
    const plan = await getDb().plan.create({
      data: { name: `e2e-catalog-${Date.now()}`, maxEvents: 5, maxParticipantsPerEvent: 200 },
    });
    await loginAs(page, staff);

    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await page.getByLabel("Plan").selectOption(plan.id);
    await page.getByLabel("Période").selectOption("MONTHLY");
    await page.getByLabel("Statut").selectOption("ACTIVE");
    await page.getByRole("button", { name: /Enregistrer/ }).click();

    await expect(async () => {
      const sub = await getDb().subscription.findUnique({ where: { orgId } });
      expect(sub?.planId).toBe(plan.id);
      expect(sub?.period).toBe("MONTHLY");
      const days = Math.round(
        (sub!.endDate!.getTime() - sub!.startDate.getTime()) / 86_400_000,
      );
      expect(days).toBe(30);
    }).toPass();
  });

  test("attribution d'un plan annuel : endDate calculee a +365 jours", async ({ page }) => {
    const staff = await createTestStaff({ scope: "sub-annual", role: "STAFF_ADMIN" });
    const { orgId } = await createTestOrgWithOwner({ scope: "sub-annual" });
    const plan = await getDb().plan.create({
      data: { name: `e2e-catalog-y-${Date.now()}`, maxEvents: null, maxParticipantsPerEvent: null },
    });
    await loginAs(page, staff);

    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await page.getByLabel("Plan").selectOption(plan.id);
    await page.getByLabel("Période").selectOption("ANNUAL");
    await page.getByRole("button", { name: /Enregistrer/ }).click();

    await expect(async () => {
      const sub = await getDb().subscription.findUnique({ where: { orgId } });
      expect(sub?.period).toBe("ANNUAL");
      const days = Math.round(
        (sub!.endDate!.getTime() - sub!.startDate.getTime()) / 86_400_000,
      );
      expect(days).toBe(365);
    }).toPass();
  });
});
