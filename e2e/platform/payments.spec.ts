import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestOrgWithOwner, createTestUser, disconnectDb } from "../helpers/db";
import { loginAs, loginAsStaff } from "../helpers/auth";
import { cleanupBillingPlans, createTestPlan, createTestSubscriptionPayment } from "../helpers/billing";

// Module Paiements staff — /platform/payments (+ fiche et recu). Rôle mini : STAFF_OBSERVER, lecture seule.
test.describe("Platform — Paiements", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await cleanupBillingPlans();
    await disconnectDb();
  });

  test("STAFF_OBSERVER voit les paiements de toutes les organisations", async ({ page }) => {
    const a = await createTestOrgWithOwner({ scope: "ppay-all-a" });
    const b = await createTestOrgWithOwner({ scope: "ppay-all-b" });
    const plan = await createTestPlan({ scope: "ppay-all", price: 13131 });
    await createTestSubscriptionPayment({ orgId: a.orgId, planId: plan.id, amount: 13131 });
    await createTestSubscriptionPayment({ orgId: b.orgId, planId: plan.id, amount: 24242 });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "ppay-all" });

    await page.goto("/platform");
    await page.getByRole("link", { name: "Paiements" }).first().click();
    await expect(page).toHaveURL(/\/platform\/payments$/);
    await expect(page.getByRole("heading", { name: "Paiements" })).toBeVisible();
    await page.getByLabel("Organisation").fill("E2E Org ppay-all");
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page).toHaveURL(/orgQuery=/);
    await expect(page.getByText(/13\s131 FCFA/).first()).toBeVisible();
    await expect(page.getByText(/24\s242 FCFA/).first()).toBeVisible();
  });

  test("Filtre par organisation et par reference FedaPay", async ({ page }) => {
    const a = await createTestOrgWithOwner({ scope: "ppay-flt-a" });
    const b = await createTestOrgWithOwner({ scope: "ppay-flt-b" });
    const plan = await createTestPlan({ scope: "ppay-flt", price: 15151 });
    await createTestSubscriptionPayment({ orgId: a.orgId, planId: plan.id, amount: 15151 });
    const target = await createTestSubscriptionPayment({ orgId: b.orgId, planId: plan.id, amount: 26262 });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "ppay-flt" });

    await page.goto("/platform/payments");
    await page.getByLabel("Organisation").fill("E2E Org ppay-flt-b");
    await page.getByLabel("Référence FedaPay").fill(target.fedapayReference!);
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page).toHaveURL(/q=trx_e2e_/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText(/26\s262 FCFA/)).toBeVisible();
    await expect(page.getByText(/15\s151 FCFA/)).toHaveCount(0);
  });

  test("Fiche et recu d'un paiement", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "ppay-detail" });
    const plan = await createTestPlan({ scope: "ppay-detail", price: 17171 });
    const payment = await createTestSubscriptionPayment({ orgId, planId: plan.id, amount: 17171 });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "ppay-detail" });

    await page.goto("/platform/payments");
    await page.getByLabel("Référence FedaPay").fill(payment.fedapayReference!);
    await page.getByRole("button", { name: "Filtrer" }).click();
    await page.getByRole("link", { name: "Voir" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/platform/payments/${payment.id}$`));
    await expect(page.getByText(payment.fedapayReference!)).toBeVisible();
    await expect(page.getByText("E2E Org ppay-detail").first()).toBeVisible();

    const receipt = await page.goto(`/platform/payments/${payment.id}/receipt`);
    expect(receipt?.status()).toBe(200);
    expect(receipt?.headers()["content-type"]).toContain("text/html");
  });

  test("Un utilisateur non staff est redirige", async ({ page }) => {
    const user = await createTestUser({ scope: "ppay-nonstaff", verified: true });
    await loginAs(page, user);

    await page.goto("/platform/payments");
    await expect(page).not.toHaveURL(/\/platform\/payments/);
    await expect(page.getByRole("heading", { name: "Paiements" })).toHaveCount(0);
  });

  for (const [width, height] of [
    [375, 812],
    [1024, 768],
    [1280, 800],
  ] as const) {
    test(`Pas de debordement horizontal a ${width}px`, async ({ page }) => {
      const { orgId } = await createTestOrgWithOwner({ scope: `ppay-resp-${width}` });
      const plan = await createTestPlan({ scope: `ppay-resp-${width}`, price: 9000 });
      await createTestSubscriptionPayment({ orgId, planId: plan.id, amount: 9000 });
      await page.setViewportSize({ width, height });
      await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: `ppay-resp-${width}` });

      await page.goto("/platform/payments");
      await expect(page.locator("main").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      const m = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(m.doc).toBeLessThanOrEqual(m.inner);
    });
  }
});
