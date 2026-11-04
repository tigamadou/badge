import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, disconnectDb, getDb } from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";
import { cleanupBillingPlans, createTestPlan } from "../helpers/billing";

// Page Plans (catalogue) — /platform/plans
// Rôle : STAFF_ADMIN. Actions : creer un plan, archiver / restaurer (toggle par
// ligne). Garde-fou : 409 NAME_TAKEN sur un nom deja utilise.
// Note : l'etat vide du catalogue n'est pas testable — la page liste TOUS les
// plans sans filtre et la base dev en contient toujours (seed + autres specs).
test.describe("Platform — Plans", () => {
  const createdPlanIds: string[] = [];

  test.afterAll(async () => {
    // Les plans crees ici ne suivent pas la convention de nommage du cleanup
    // global : on les retire explicitement (sans casser les FK Subscription).
    for (const id of createdPlanIds) {
      await getDb()
        .plan.delete({ where: { id } })
        .catch(() => undefined);
    }
    await cleanupE2ETestData();
    await cleanupBillingPlans();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("STAFF_ADMIN voit le catalogue et le formulaire", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "plans-render" });

    await page.goto("/platform/plans");
    await expect(page.getByLabel("Nom")).toBeVisible();
    await expect(page.getByRole("button", { name: /créer le plan/i })).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("STAFF_ADMIN cree un plan puis l'archive et le restaure", async ({ page }) => {
    const staff = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "plans-create" });
    const planName = `E2E Plan ${Date.now()}`;

    await page.goto("/platform/plans");
    await page.getByLabel("Nom").fill(planName);
    await page.getByLabel(/Max events/i).fill("5");
    await page.getByLabel(/Max participants\/event/i).fill("100");
    await page.getByRole("button", { name: /créer le plan/i }).click();

    const row = page.locator("tr", { hasText: planName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("5");
    await expect(row).toContainText("100");

    const dbPlan = await getDb().plan.findUnique({ where: { name: planName } });
    expect(dbPlan?.maxEvents).toBe(5);
    expect(dbPlan?.maxParticipantsPerEvent).toBe(100);
    expect(dbPlan?.archived).toBe(false);
    createdPlanIds.push(dbPlan!.id);

    await expectLastActivity({ type: "PLAN_CREATED", userId: staff.id });

    // Toggle archiver / restaurer sur la ligne.
    await row.getByRole("button", { name: /archiver/i }).click();
    await expect(row.getByRole("button", { name: /restaurer/i })).toBeVisible();
    expect(
      (await getDb().plan.findUnique({ where: { id: dbPlan!.id }, select: { archived: true } }))
        ?.archived,
    ).toBe(true);

    await row.getByRole("button", { name: /restaurer/i }).click();
    await expect(row.getByRole("button", { name: /archiver/i })).toBeVisible();
    expect(
      (await getDb().plan.findUnique({ where: { id: dbPlan!.id }, select: { archived: true } }))
        ?.archived,
    ).toBe(false);
  });

  test("Un plan sans limites est cree comme illimite", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "plans-unlimited" });
    const planName = `E2E Plan Illimite ${Date.now()}`;

    await page.goto("/platform/plans");
    await page.getByLabel("Nom").fill(planName);
    await page.getByRole("button", { name: /créer le plan/i }).click();

    await expect(page.locator("tr", { hasText: planName })).toBeVisible();
    const dbPlan = await getDb().plan.findUnique({ where: { name: planName } });
    expect(dbPlan?.maxEvents).toBeNull();
    expect(dbPlan?.maxParticipantsPerEvent).toBeNull();
    createdPlanIds.push(dbPlan!.id);
  });

  test("STAFF_ADMIN edite la fiche publique d'un plan", async ({ page }) => {
    const staff = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "plans-public" });
    const plan = await createTestPlan({ scope: "plans-public", price: 20000 });

    await page.goto("/platform/plans");
    const row = page.locator("tr", { hasText: plan.name }).first();
    await expect(row).toContainText("Masqué");
    await row.getByRole("button", { name: "Fiche publique" }).click();

    const panel = page.locator("tr", { hasText: "Visible sur /tarifs" });
    await panel.getByLabel("Visible sur /tarifs").check();
    await panel.getByLabel("Mis en avant").check();
    await panel.getByLabel(/Position/).fill("7");
    await panel.getByLabel(/Description courte/).fill("Pour les equipes en croissance");
    await panel.getByLabel(/Fonctionnalités/).fill("Badges PDF\nScanner mobile");
    await panel.getByRole("button", { name: "Enregistrer" }).click();

    await expect(row).toContainText("Visible · position 7 · mis en avant");
    const db = await getDb().plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(db.publicVisible).toBe(true);
    expect(db.highlighted).toBe(true);
    expect(db.position).toBe(7);
    expect(db.description).toBe("Pour les equipes en croissance");
    expect(db.features).toEqual(["Badges PDF", "Scanner mobile"]);
    await expectLastActivity({ type: "PLAN_UPDATED", userId: staff.id, targetId: plan.id });
  });

  // --- Gardes & API -------------------------------------------------------

  test("Creer un plan avec un nom deja pris affiche une erreur (UI)", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "plans-dup" });
    const planName = `E2E Plan Dup ${Date.now()}`;
    // Pre-condition : un plan de ce nom existe deja.
    const existing = await getDb().plan.create({ data: { name: planName, period: "MONTHLY" } });
    createdPlanIds.push(existing.id);

    await page.goto("/platform/plans");
    await page.getByLabel("Nom").fill(planName);
    await page.getByRole("button", { name: /créer le plan/i }).click();

    // Reponse attendue — ECHEC : message d'erreur UI, aucun 2e plan cree.
    await expect(page.getByText(/ce nom de plan existe déjà/i)).toBeVisible();
    expect(await getDb().plan.count({ where: { name: planName } })).toBe(1);
  });

});
