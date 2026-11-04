import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgMember,
  createTestOrgWithOwner,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { loginAndEnter } from "../helpers/nav";
import {
  DAY_MS,
  cleanupBillingPlans,
  createTestPlan,
  createTestSubscriptionPayment,
  fmtDateFr,
  setSubscription,
} from "../helpers/billing";

// Module Paiements — /org/[orgId]/payments (+ fiche et recu). Rôle mini : MANAGER, lecture seule.
// Reste consultable avec un abonnement echu (comme la page Abonnement).
test.describe("Org — Paiements", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await cleanupBillingPlans();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("MANAGER voit les paiements de son organisation, pas ceux d'une autre", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pay-scope-a" });
    const { orgId: otherOrgId } = await createTestOrgWithOwner({ scope: "pay-scope-b" });
    const plan = await createTestPlan({ scope: "pay-scope", price: 12345 });
    await createTestSubscriptionPayment({ orgId, planId: plan.id, amount: 12345 });
    await createTestSubscriptionPayment({ orgId: otherOrgId, planId: plan.id, amount: 54321 });
    const manager = await createTestOrgMember({ scope: "pay-scope-mgr", orgId, role: "MANAGER" });
    await loginAndEnter(page, manager, { kind: "org", id: orgId });

    await page.getByRole("link", { name: "Paiements" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/payments$`));
    await expect(page.getByRole("heading", { name: "Paiements" })).toBeVisible();
    await expect(page.getByText(/12\s345 FCFA/).first()).toBeVisible();
    await expect(page.getByText(/54\s321 FCFA/)).toHaveCount(0);
  });

  test("AUDITOR est redirige vers le dashboard (garde MANAGER)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pay-aud" });
    const auditor = await createTestOrgMember({ scope: "pay-aud-user", orgId, role: "AUDITOR" });
    await loginAs(page, auditor);

    await page.goto(`/org/${orgId}/payments`);
    await page.waitForURL(`**/org/${orgId}`);
    await expect(page.getByRole("heading", { name: "Paiements" })).toHaveCount(0);
  });

  test("Abonnement echu : la page Paiements reste accessible depuis l'Abonnement", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pay-expired" });
    await getDb().subscription.update({ where: { orgId }, data: { status: "EXPIRED" } });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/subscription`);
    await page.getByRole("link", { name: /voir tous les paiements/i }).click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/payments$`));
    await expect(page.getByRole("heading", { name: "Paiements" })).toBeVisible();
    await expect(page.getByText(/n'est pas actif/i)).toHaveCount(0);
  });

  // --- Actions UI ---------------------------------------------------------

  test("Le filtre de statut vit dans l'URL et survit au rechargement", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pay-filter" });
    const plan = await createTestPlan({ scope: "pay-filter", price: 11111 });
    await createTestSubscriptionPayment({ orgId, planId: plan.id, amount: 11111, status: "APPROVED" });
    await createTestSubscriptionPayment({ orgId, planId: plan.id, amount: 22222, status: "DECLINED" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/payments`);
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.getByLabel("Statut").selectOption("APPROVED");
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page).toHaveURL(/status=APPROVED/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText(/11\s111 FCFA/)).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/status=APPROVED/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByLabel("Statut")).toHaveValue("APPROVED");
  });

  test("pageSize=10 pagine la liste", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pay-page" });
    const plan = await createTestPlan({ scope: "pay-page", price: 1000 });
    for (let i = 0; i < 12; i++) {
      await createTestSubscriptionPayment({
        orgId,
        planId: plan.id,
        amount: 1000,
        status: "DECLINED",
        createdAt: new Date(Date.now() - i * 60_000),
      });
    }
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/payments?pageSize=10`);
    await expect(page.locator("tbody tr")).toHaveCount(10);
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("tbody tr")).toHaveCount(2);
  });

  test("La fiche d'un paiement montre le prorata et la periode couverte", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pay-detail" });
    const plan = await createTestPlan({ scope: "pay-detail", price: 30000 });
    const from = new Date(Date.now() - 2 * DAY_MS);
    const to = new Date(Date.now() + 28 * DAY_MS);
    await createTestSubscriptionPayment({
      orgId,
      planId: plan.id,
      amount: 20000,
      listPrice: 30000,
      prorataCredit: 10000,
      coversFrom: from,
      coversTo: to,
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/payments`);
    await page.getByRole("link", { name: "Voir" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/payments/[^/]+$`));
    await expect(page.getByText(/30\s000 FCFA/).first()).toBeVisible();
    await expect(page.getByText(/−\s10\s000 FCFA/)).toBeVisible();
    await expect(page.getByText(/20\s000 FCFA/).first()).toBeVisible();
    await expect(
      page.getByText(`Période couverte du ${fmtDateFr(from)} au ${fmtDateFr(to)}`),
    ).toBeVisible();
  });

  // --- Gardes -------------------------------------------------------------

  test("Un paiement d'une autre organisation -> 404", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pay-foreign-a" });
    const { orgId: otherOrgId } = await createTestOrgWithOwner({ scope: "pay-foreign-b" });
    const plan = await createTestPlan({ scope: "pay-foreign", price: 5000 });
    const foreign = await createTestSubscriptionPayment({ orgId: otherOrgId, planId: plan.id, amount: 5000 });
    await loginAs(page, owner);

    const res = await page.goto(`/org/${orgId}/payments/${foreign.id}`);
    expect(res?.status()).toBe(404);
  });

  test("Recu : HTML pour un paiement approuve, 404 pour un paiement en attente", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pay-receipt" });
    const plan = await createTestPlan({ scope: "pay-receipt", price: 7000 });
    const paid = await createTestSubscriptionPayment({ orgId, planId: plan.id, amount: 7000, status: "APPROVED" });
    const pending = await createTestSubscriptionPayment({ orgId, planId: plan.id, amount: 7000, status: "PENDING" });
    await loginAs(page, owner);

    const ok = await page.goto(`/org/${orgId}/payments/${paid.id}/receipt`);
    expect(ok?.status()).toBe(200);
    expect(ok?.headers()["content-type"]).toContain("text/html");
    await expect(page.getByText(/7\s000 FCFA/).first()).toBeVisible();

    const missing = await page.goto(`/org/${orgId}/payments/${pending.id}/receipt`);
    expect(missing?.status()).toBe(404);
  });

  // --- Responsive ---------------------------------------------------------

  for (const [width, height] of [
    [375, 812],
    [1024, 768],
    [1280, 800],
  ] as const) {
    test(`Pas de debordement horizontal a ${width}px (Paiements et Abonnement)`, async ({ page }) => {
      const { orgId, owner } = await createTestOrgWithOwner({ scope: `pay-resp-${width}` });
      const plan = await createTestPlan({ scope: `pay-resp-${width}`, price: 15000 });
      await setSubscription(orgId, {
        planId: plan.id,
        startDate: new Date(Date.now() - 5 * DAY_MS),
        endDate: new Date(Date.now() + 25 * DAY_MS),
      });
      await createTestSubscriptionPayment({ orgId, planId: plan.id, amount: 15000 });
      await page.setViewportSize({ width, height });
      await loginAs(page, owner);

      for (const path of [`/org/${orgId}/payments`, `/org/${orgId}/subscription`]) {
        await page.goto(path);
        await expect(page.locator("main").first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        const m = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          inner: window.innerWidth,
        }));
        expect(m.doc, `${path} @${width}px`).toBeLessThanOrEqual(m.inner);
      }
    });
  }
});
