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

  test("parcours complet : creation org -> abonnement free par defaut -> changement de plan", async ({
    page,
  }) => {
    const staff = await createTestStaff({ scope: "full-flow", role: "STAFF_ADMIN" });
    const plan = await getDb().plan.create({
      data: { name: `e2e-full-${Date.now()}`, period: "ANNUAL", maxEvents: 3, maxParticipantsPerEvent: 50 },
    });
    await loginAs(page, staff);

    // 1. Creation (le slug est genere automatiquement).
    await page.goto("/platform/organizations/new");
    const orgName = `Org Flow ${Date.now()}`;
    await page.getByLabel("Nom de l'organisation").fill(orgName);
    await page.getByLabel("E-mail du OWNER").fill(`owner-full-${Date.now()}@v2-11-e2e.test`);
    await page.getByRole("button", { name: /Créer l'organisation/ }).click();

    // 2. Redirection vers la fiche detail de l'org creee.
    // Le lookahead exclut /organizations/new (la page courante), qui matcherait
    // sinon le motif et ferait resoudre waitForURL immediatement.
    await page.waitForURL(/\/platform\/organizations\/(?!new$)[^/]+$/);
    const orgId = page.url().split("/").pop()!;
    await expect(page.getByText(orgName).first()).toBeVisible();

    // A ce stade l'org a deja l'abonnement du plan par defaut « free » (cree par le seed).
    const freePlan = await getDb().plan.findUniqueOrThrow({ where: { name: "free" } });
    const initial = await getDb().subscription.findUnique({ where: { orgId } });
    expect(initial?.planId).toBe(freePlan.id);
    expect(initial?.status).toBe("ACTIVE");

    // 3. Changement de plan depuis l'onglet Abonnement : resume d'abord, formulaire via Modifier.
    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await page.getByRole("button", { name: "Modifier" }).click();
    await page.getByLabel("Plan").selectOption(plan.id);
    await page.getByLabel("Statut").selectOption("ACTIVE");
    await page.getByRole("button", { name: /Enregistrer/ }).click();

    // 4. L'abonnement est actif ; les dates derivent de la periode du plan (ANNUAL).
    await expect(async () => {
      const sub = await getDb().subscription.findUnique({ where: { orgId } });
      expect(sub?.status).toBe("ACTIVE");
      expect(sub?.planId).toBe(plan.id);
      expect(
        Math.round((sub!.endDate!.getTime() - sub!.startDate.getTime()) / 86_400_000),
      ).toBe(365);
    }).toPass();
  });

  test("attribution d'un plan mensuel : endDate calculee a +30 jours", async ({ page }) => {
    const staff = await createTestStaff({ scope: "sub-assign", role: "STAFF_ADMIN" });
    const { orgId } = await createTestOrgWithOwner({ scope: "sub-assign" });
    const plan = await getDb().plan.create({
      data: { name: `e2e-catalog-${Date.now()}`, period: "MONTHLY", maxEvents: 5, maxParticipantsPerEvent: 200 },
    });
    await loginAs(page, staff);

    // L'org de test a deja un abonnement : resume d'abord, formulaire via Modifier.
    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await page.getByRole("button", { name: "Modifier" }).click();
    await page.getByLabel("Plan").selectOption(plan.id);
    await page.getByLabel("Statut").selectOption("ACTIVE");
    await page.getByRole("button", { name: /Enregistrer/ }).click();

    await expect(async () => {
      const sub = await getDb().subscription.findUnique({ where: { orgId } });
      expect(sub?.planId).toBe(plan.id);
      const days = Math.round(
        (sub!.endDate!.getTime() - sub!.startDate.getTime()) / 86_400_000,
      );
      expect(days).toBe(30);
    }).toPass();
  });

  test("org sans abonnement actif : espace bloque sauf l'onglet Abonnement", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "sub-blocked",
      activeSubscription: false,
    });
    await loginAs(page, owner);

    // Dashboard bloque.
    await page.goto(`/org/${orgId}`);
    await expect(page.getByText("Abonnement inactif")).toBeVisible();
    await expect(page.getByText(/Contactez le staff Badge/)).toBeVisible();

    // Une autre sous-page l'est aussi.
    await page.goto(`/org/${orgId}/events`);
    await expect(page.getByText("Abonnement inactif")).toBeVisible();

    // L'onglet Abonnement reste consultable.
    await page.goto(`/org/${orgId}/subscription`);
    await expect(page.getByText("Abonnement inactif")).toHaveCount(0);
    await expect(page.getByText("Aucun abonnement")).toBeVisible();
  });

  test("org avec abonnement actif : espace accessible (non-regression)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "sub-ok" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}`);
    await expect(page.getByText("Abonnement inactif")).toHaveCount(0);

    await page.goto(`/org/${orgId}/events`);
    await expect(page.getByText("Abonnement inactif")).toHaveCount(0);
  });

  test("attribution d'un plan annuel : endDate calculee a +365 jours", async ({ page }) => {
    const staff = await createTestStaff({ scope: "sub-annual", role: "STAFF_ADMIN" });
    const { orgId } = await createTestOrgWithOwner({ scope: "sub-annual" });
    const plan = await getDb().plan.create({
      data: { name: `e2e-catalog-y-${Date.now()}`, period: "ANNUAL", maxEvents: null, maxParticipantsPerEvent: null },
    });
    await loginAs(page, staff);

    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await page.getByRole("button", { name: "Modifier" }).click();
    await page.getByLabel("Plan").selectOption(plan.id);
    await page.getByRole("button", { name: /Enregistrer/ }).click();

    await expect(async () => {
      const sub = await getDb().subscription.findUnique({ where: { orgId } });
      const days = Math.round(
        (sub!.endDate!.getTime() - sub!.startDate.getTime()) / 86_400_000,
      );
      expect(days).toBe(365);
    }).toPass();
  });
});
