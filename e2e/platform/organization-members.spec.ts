import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestOrgMember,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

// Page Membres d'une org (supervision) — /platform/organizations/[orgId]/members
// Rôle : STAFF_ADMIN pour inviter. La table est en LECTURE SEULE : le retrait
// (DELETE /owners/[userId]) n'a pas de bouton, il est teste en API ici.
test.describe("Platform — Membres d'une organisation", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("STAFF voit la table des membres", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pmem-render" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pmem-render-staff" });

    await page.goto(`/platform/organizations/${orgId}/members`);
    await expect(page.getByText(owner.email)).toBeVisible();
    await expect(page.getByRole("heading", { name: /inviter un membre/i })).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("STAFF_ADMIN invite un membre MANAGER via le formulaire", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pmem-invite" });
    const staff = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pmem-invite-staff" });

    await page.goto(`/platform/organizations/${orgId}/members`);
    const email = `pmem-invitee-${Date.now()}@v2-11-e2e.test`;
    await page.getByPlaceholder("Nom complet").fill("Invite Plateforme");
    await page.getByPlaceholder("email@exemple.fr").fill(email);
    await page.locator("select").selectOption("MANAGER");
    await page.getByRole("button", { name: /^inviter$/i }).click();

    await expect(page.getByText(email)).toBeVisible();

    const created = await getDb().user.findUnique({ where: { email }, select: { id: true } });
    expect(created).not.toBeNull();
    const membership = await getDb().orgMembership.findUnique({
      where: { userId_orgId: { userId: created!.id, orgId } },
    });
    expect(membership?.role).toBe("MANAGER");

    await expectLastActivity({ type: "MEMBERSHIP_ADDED", orgId, userId: staff.id });
  });

  test("STAFF_ADMIN invite un membre AUDITOR", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pmem-auditor" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pmem-auditor-staff" });

    await page.goto(`/platform/organizations/${orgId}/members`);
    const email = `pmem-aud-${Date.now()}@v2-11-e2e.test`;
    await page.getByPlaceholder("Nom complet").fill("Auditeur Plateforme");
    await page.getByPlaceholder("email@exemple.fr").fill(email);
    await page.locator("select").selectOption("AUDITOR");
    await page.getByRole("button", { name: /^inviter$/i }).click();

    await expect(page.getByText(email)).toBeVisible();
    const created = await getDb().user.findUnique({ where: { email }, select: { id: true } });
    const membership = await getDb().orgMembership.findUnique({
      where: { userId_orgId: { userId: created!.id, orgId } },
    });
    expect(membership?.role).toBe("AUDITOR");
  });

  // --- Gardes & API (retrait : pas de surface UI) -------------------------

  test("Retrait d'un OWNER (quand il en reste un autre) -> 204", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pmem-remove" });
    // La route ne gere QUE les OWNERs : il en faut deux pour pouvoir en retirer un.
    const secondOwner = await createTestOrgMember({
      scope: "pmem-remove-target",
      orgId,
      role: "OWNER",
    });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pmem-remove-staff" });

    const res = await page.request.delete(
      `/api/platform/organizations/${orgId}/owners/${secondOwner.id}`,
    );
    expect(res.status()).toBe(204);

    expect(
      await getDb().orgMembership.findUnique({
        where: { userId_orgId: { userId: secondOwner.id, orgId } },
      }),
    ).toBeNull();
  });

  test("Retrait d'un membre non-OWNER -> 409 NOT_OWNER", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pmem-notowner-role" });
    const manager = await createTestOrgMember({
      scope: "pmem-notowner-role-target",
      orgId,
      role: "MANAGER",
    });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pmem-notowner-role-staff" });

    const res = await page.request.delete(
      `/api/platform/organizations/${orgId}/owners/${manager.id}`,
    );
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toBe("NOT_OWNER");
  });

  test("Retrait du dernier OWNER -> 409 LAST_OWNER", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "pmem-last" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pmem-last-staff" });

    const res = await page.request.delete(
      `/api/platform/organizations/${orgId}/owners/${owner.id}`,
    );
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toBe("LAST_OWNER");
  });

  test("Retrait d'un non-membre -> 404", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pmem-notowner" });
    const { owner: etranger } = await createTestOrgWithOwner({ scope: "pmem-notowner-other" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pmem-notowner-staff" });

    const res = await page.request.delete(
      `/api/platform/organizations/${orgId}/owners/${etranger.id}`,
    );
    // L'utilisateur n'a aucune membership sur cette org.
    expect(res.status()).toBe(404);
  });

  test("STAFF_OBSERVER -> 403 sur l'invitation", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pmem-observer" });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "pmem-observer-staff" });

    const res = await page.request.post(`/api/platform/organizations/${orgId}/owners`, {
      data: { name: "X", email: `nope-${Date.now()}@v2-11-e2e.test`, role: "MANAGER" },
    });
    expect(res.status()).toBe(403);
  });
});
