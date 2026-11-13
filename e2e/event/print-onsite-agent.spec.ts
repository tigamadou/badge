import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestOrgMember,
  createTestPrintProduct,
  createTestPrintRequest,
  createTestRegistration,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { toast } from "../helpers/feedback";

const qrOf = (registrationId: string) => `https://badge.example/verify/${registrationId}`;

async function seedOnsite(scope: string) {
  const { orgId, eventId, categoryId } = await createTestEvent({ scope });
  const organizer = await createTestUser({ scope: `${scope}-org`, verified: true });
  const product = await createTestPrintProduct({ name: `Support PVC ${scope}`, kind: "BADGE" });
  const request = await createTestPrintRequest({
    eventId,
    orgId,
    createdById: organizer.id,
    type: "ONSITE",
    status: "PAID",
    marginPercent: 10,
    lines: [{ label: "Support badge PVC", quantity: 10, unitPrice: 1500, kind: "PRODUCT", productId: product.id }],
  });
  return { orgId, eventId, categoryId, request };
}

// Poste d'impression sur place tenu par un AGENT d'organisation (spec 37, décision 10) :
// /event/[eventId]/print/onsite puis /event/[eventId]/print/[requestId]/onsite. Aucun prix n'est affiché.
test.describe("Event — Poste sur place de l'agent", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("l'AGENT va de l'organisation au poste, scanne un QR d'accueil et imprime, sans voir de prix", async ({ page }) => {
    const { orgId, eventId, categoryId, request } = await seedOnsite("onsite-agent");
    const participant = await createTestUser({ scope: "onsite-agent-part", verified: true, profile: true });
    const reg = await createTestRegistration({ eventId, userId: participant.id, categoryId, status: "APPROVED" });
    const agent = await createTestOrgMember({ scope: "onsite-agent", orgId, role: "AGENT" });
    await loginAndEnter(page, agent, { kind: "org", id: orgId });

    await page.getByRole("link", { name: /^Événements/ }).click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/events$`));
    await page.locator(`a[href="/event/${eventId}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}$`));

    // Tableau de bord réduit : ses scans et le poste, ni compteurs ni inscriptions.
    await expect(page.getByText("Mes scans")).toBeVisible();
    await expect(page.getByText("Dernières inscriptions")).toHaveCount(0);

    await page.getByRole("link", { name: /^Poste sur place/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print/onsite$`));
    await expect(page.getByRole("link", { name: new RegExp(request.reference) })).toBeVisible();
    await expect(page.getByText(/FCFA|15\s?000/)).toHaveCount(0);

    await page.getByRole("link", { name: new RegExp(request.reference) }).click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/print/${request.id}/onsite$`));
    await page.getByRole("button", { name: "Désactiver la caméra" }).click();
    await page.getByLabel("Nom, email, ID ou contenu du QR").fill(qrOf(reg.id));
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(page.getByRole("button", { name: "Imprimer", exact: true })).toBeEnabled();

    const popup = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Imprimer", exact: true }).click();
    await popup;
    await expect(toast(page, "Badge envoyé à l'impression")).toBeVisible();

    const prints = await getDb().printRequestPrint.findMany({ where: { requestId: request.id } });
    expect(prints).toHaveLength(1);
    expect(prints[0]).toMatchObject({ registrationId: reg.id, printedById: agent.id, reprint: false });
  });

  test("l'AGENT n'accède ni aux inscriptions ni aux commandes d'impression", async ({ page }) => {
    const { orgId, eventId, request } = await seedOnsite("onsite-agent-deny");
    const agent = await createTestOrgMember({ scope: "onsite-agent-deny", orgId, role: "AGENT" });
    await loginAndEnter(page, agent, { kind: "org", id: orgId });
    await page.goto(`/event/${eventId}`);
    await expect(page.getByRole("link", { name: /^Inscriptions/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Impression$/ })).toHaveCount(0);

    // La fiche d'une commande (devis, prix) renvoie au tableau de bord.
    await page.goto(`/event/${eventId}/print/${request.id}`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}$`));
  });

  test("un membre d'organisation sans print.onsite.operate (AUDITOR) est renvoyé du poste", async ({ page }) => {
    const { orgId, eventId, request } = await seedOnsite("onsite-auditor");
    const auditor = await createTestOrgMember({ scope: "onsite-auditor", orgId, role: "AUDITOR" });
    await loginAndEnter(page, auditor, { kind: "org", id: orgId });
    await page.goto(`/event/${eventId}/print/${request.id}/onsite`);
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}$`));
  });
});
