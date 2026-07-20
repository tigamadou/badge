import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, disconnectDb, getDb } from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

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

  // --- Gardes & API -------------------------------------------------------

  test("Nom deja pris -> 409 NAME_TAKEN", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "plans-dup" });
    const planName = `E2E Plan Dup ${Date.now()}`;

    const first = await page.request.post("/api/platform/plans", {
      data: { name: planName, maxEvents: 1, maxParticipantsPerEvent: 1 },
    });
    expect(first.status()).toBe(201);
    createdPlanIds.push((await first.json()).plan.id);

    const second = await page.request.post("/api/platform/plans", {
      data: { name: planName, maxEvents: 2, maxParticipantsPerEvent: 2 },
    });
    expect(second.status()).toBe(409);
    expect((await second.json()).error).toBe("NAME_TAKEN");
  });

  test("STAFF_OBSERVER -> 403 sur la creation", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "plans-observer" });

    const res = await page.request.post("/api/platform/plans", {
      data: { name: `Refuse ${Date.now()}`, maxEvents: 1, maxParticipantsPerEvent: 1 },
    });
    expect(res.status()).toBe(403);
  });
});
