import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestOrgMember,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import {
  DAY_MS,
  cleanupBillingPlans,
  createTestPlan,
  createTestSubscriptionPayment,
  digits,
  fmtDateFr,
  setSubscription,
} from "../helpers/billing";

// Page Abonnement — /org/[orgId]/subscription
// Rôle mini : MANAGER (garde dans la page, AUDITOR redirige vers le dashboard).
// Lecture seule pour MANAGER/AUDITOR ; seul l'OWNER voit les boutons de paiement (le paiement lui-meme
// s'arrete a FedaPay, non joignable en e2e : l'application d'un paiement est couverte par Vitest).
// Reste consultable meme quand l'abonnement est inactif (le layout la laisse passer).
test.describe("Org — Abonnement", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await cleanupBillingPlans();
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

  // --- Renouvellement, prorata, droits de paiement -------------------------

  test("Plan actif a plus de 7 jours : echeance annoncee et Renouveler desactive", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "sub-renew-blocked" });
    const plan = await createTestPlan({ scope: "renew-blocked", price: 10000 });
    const end = new Date(Date.now() + 20 * DAY_MS);
    await setSubscription(orgId, { planId: plan.id, startDate: new Date(Date.now() - 10 * DAY_MS), endDate: end });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/subscription`);
    const card = page.locator("li", { hasText: plan.name });
    await expect(card).toContainText(
      `Votre abonnement est actif jusqu'au ${fmtDateFr(end)}, renouvelable à partir du ${fmtDateFr(new Date(end.getTime() - 7 * DAY_MS))}.`,
    );
    await expect(card.getByRole("button", { name: "Renouveler" })).toBeDisabled();
  });

  test("Checkout du meme plan hors fenetre : 409 ALREADY_ACTIVE", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "sub-already-active" });
    const plan = await createTestPlan({ scope: "already-active", price: 10000 });
    await setSubscription(orgId, {
      planId: plan.id,
      startDate: new Date(Date.now() - 10 * DAY_MS),
      endDate: new Date(Date.now() + 20 * DAY_MS),
    });
    await loginAs(page, owner);

    const res = await page.request.post(`/api/org/${orgId}/subscription/checkout`, { data: { planId: plan.id } });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toBe("ALREADY_ACTIVE");
  });

  test("Echeance a moins de 7 jours : Renouveler actif", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "sub-renew-open" });
    const plan = await createTestPlan({ scope: "renew-open", price: 10000 });
    await setSubscription(orgId, {
      planId: plan.id,
      startDate: new Date(Date.now() - 27 * DAY_MS),
      endDate: new Date(Date.now() + 3 * DAY_MS),
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/subscription`);
    const card = page.locator("li", { hasText: plan.name });
    await expect(card.getByRole("button", { name: "Renouveler" })).toBeEnabled();
  });

  test("Montee en gamme : apercu du prix plein, du credit au prorata et du montant a payer", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "sub-prorata" });
    const current = await createTestPlan({ scope: "prorata-cur", price: 10000 });
    const higher = await createTestPlan({ scope: "prorata-up", price: 30000 });
    const start = new Date(Date.now() - 10 * DAY_MS);
    const end = new Date(Date.now() + 20 * DAY_MS);
    await setSubscription(orgId, { planId: current.id, startDate: start, endDate: end });
    await createTestSubscriptionPayment({
      orgId,
      planId: current.id,
      amount: 10000,
      coversFrom: start,
      coversTo: end,
      createdAt: start,
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/subscription`);
    const card = page.locator("li", { hasText: higher.name });
    const text = (await card.textContent()) ?? "";
    const m = text.match(/Prix plein ([\d\s\u202f\u00a0]+)FCFA − crédit ([\d\s\u202f\u00a0]+)FCFA.*?= ([\d\s\u202f\u00a0]+)FCFA à payer/);
    expect(m, `texte du prorata introuvable dans : ${text}`).not.toBeNull();
    const [listPrice, credit, amount] = [digits(m![1]), digits(m![2]), digits(m![3])];
    expect(listPrice).toBe(30000);
    // 20 jours restants sur 30 : 6 666 FCFA, a quelques FCFA pres (le temps passe entre fixture et rendu).
    expect(Math.abs(credit - Math.floor((10000 * 20) / 30))).toBeLessThanOrEqual(5);
    expect(listPrice - credit).toBe(amount);
    await expect(card.getByRole("button", { name: "Passer à ce plan" })).toBeEnabled();
  });

  test("MANAGER voit les plans mais aucun bouton de paiement", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "sub-mgr-ro" });
    const plan = await createTestPlan({ scope: "mgr-ro", price: 10000 });
    const manager = await createTestOrgMember({ scope: "sub-mgr-ro-user", orgId, role: "MANAGER" });
    await loginAs(page, manager);

    await page.goto(`/org/${orgId}/subscription`);
    const card = page.locator("li", { hasText: plan.name });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button")).toHaveCount(0);
    await expect(page.getByText(/seul le propriétaire/i)).toBeVisible();
  });
});
