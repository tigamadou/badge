import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestOrgMember,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { loginAndEnter } from "../helpers/nav";
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity, expectNoActivity } from "../helpers/audit";

// Page Membres — /org/[orgId]/members
// Nav : MANAGER+. Mutations (POST/PATCH/DELETE members) : OWNER-only.
// PAGE DE REFERENCE : gabarit des specs par page (cf. e2e/README.md).
// Sections : Acces & rendu / Actions UI / Etats / Gardes & API.
test.describe("Org — Membres", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("OWNER voit la liste des membres", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-render" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/members`);
    await expect(page.getByRole("heading", { name: /^membres$/i })).toBeVisible();
    // L'email apparait aussi dans l'en-tete du shell : on cible la ligne du tableau.
    await expect(page.locator("tr", { hasText: owner.email })).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("OWNER invite un nouveau membre (MANAGER) via le formulaire", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-invite" });
    await mailpit.clear();
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/members`);
    const inviteeEmail = `e2e-invitee-${Date.now()}@v2-11-e2e.test`;
    await page.getByPlaceholder("Nom complet").fill("UI Invitee");
    await page.getByPlaceholder("email@exemple.fr").fill(inviteeEmail);
    await page.locator("form").getByLabel("Rôle").selectOption("MANAGER");
    await page.getByRole("button", { name: /^inviter$/i }).click();

    // Effet UI : la ligne apparait apres le refresh du formulaire.
    await expect(page.getByText("UI Invitee")).toBeVisible();
    const row = page.locator("tr", { hasText: inviteeEmail });
    await expect(row.getByRole("combobox")).toHaveValue("MANAGER");

    const created = await getDb().user.findUnique({
      where: { email: inviteeEmail },
      select: { id: true },
    });
    expect(created).not.toBeNull();
    const membership = await getDb().orgMembership.findUnique({
      where: { userId_orgId: { userId: created!.id, orgId } },
    });
    expect(membership?.role).toBe("MANAGER");

    await expectLastActivity({
      type: "MEMBERSHIP_ADDED",
      orgId,
      targetId: created!.id,
      userId: owner.id,
    });
    await mailpit.expectMail({ to: inviteeEmail });
  });

  test("OWNER invite un utilisateur existant (AUDITOR) sans creer de compte", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-invite-existing" });
    const existing = await createTestUser({ scope: "mem-existing", verified: true });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/members`);
    await page.getByPlaceholder("Nom complet").fill(existing.name);
    await page.getByPlaceholder("email@exemple.fr").fill(existing.email);
    await page.locator("form").getByLabel("Rôle").selectOption("AUDITOR");
    await page.getByRole("button", { name: /^inviter$/i }).click();

    const row = page.locator("tr", { hasText: existing.email });
    await expect(row.getByRole("combobox")).toHaveValue("AUDITOR");

    // Aucun compte cree : l'utilisateur existait deja.
    await expectNoActivity({ type: "USER_CREATED", targetId: existing.id });
    await expectLastActivity({ type: "MEMBERSHIP_ADDED", orgId, targetId: existing.id });
  });

  test("OWNER retire un membre via le bouton Retirer", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-remove" });
    const manager = await createTestOrgMember({
      scope: "mem-remove-target",
      orgId,
      role: "MANAGER",
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/members`);
    await expect(page.getByText(manager.email)).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    const row = page.locator("tr", { hasText: manager.email });
    await row.getByRole("button", { name: /^retirer$/i }).click();

    await expect(page.getByText(manager.email)).toHaveCount(0);

    const membership = await getDb().orgMembership.findUnique({
      where: { userId_orgId: { userId: manager.id, orgId } },
    });
    expect(membership).toBeNull();

    await expectLastActivity({
      type: "MEMBERSHIP_REMOVED",
      orgId,
      targetId: manager.id,
      userId: owner.id,
    });
  });

  // --- Etats --------------------------------------------------------------

  test("Dernier OWNER : pas de bouton Retirer (etat protege)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-last-owner" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/members`);
    const row = page.locator("tr", { hasText: owner.email });
    await expect(row.getByText(/dernier owner/i)).toBeVisible();
    await expect(row.getByRole("button", { name: /^retirer$/i })).toHaveCount(0);
  });

  // --- Gardes & API (inatteignable par l'UI) ------------------------------

  test("DELETE dernier OWNER -> 409 LAST_OWNER", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-api-last-rm" });
    await loginAs(page, owner);

    const res = await page.request.delete(`/api/org/${orgId}/members/${owner.id}`);
    expect(res.status()).toBe(409);
    expect((await res.json()).code).toBe("LAST_OWNER");

    const still = await getDb().orgMembership.findUnique({
      where: { userId_orgId: { userId: owner.id, orgId } },
    });
    expect(still?.role).toBe("OWNER");
  });

  test("Retrograder le dernier OWNER affiche une erreur (echec UI)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-last-demote" });
    await loginAndEnter(page, owner, { kind: "org", id: orgId });

    await page.getByRole("link", { name: /membres/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/members`));

    const row = page.locator("tr").filter({ hasText: owner.email });
    await row.getByRole("combobox").selectOption("MANAGER");

    // Reponse attendue — ECHEC : message d'erreur affiche et role inchange.
    await expect(page.getByText(/dernier OWNER/i)).toBeVisible();
    const still = await getDb().orgMembership.findUnique({
      where: { userId_orgId: { userId: owner.id, orgId } },
    });
    expect(still?.role).toBe("OWNER");
    await expect(row.getByRole("combobox")).toHaveValue("OWNER");
  });

  test("OWNER change le role d'un membre via le select inline", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-role-ui" });
    const manager = await createTestOrgMember({
      scope: "mem-role-ui-target",
      orgId,
      role: "MANAGER",
    });
    await loginAndEnter(page, owner, { kind: "org", id: orgId });

    await page.getByRole("link", { name: /membres/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/members`));

    const row = page.locator("tr").filter({ hasText: manager.email });
    await row.getByRole("combobox").selectOption("AUDITOR");

    // Reponse attendue — SUCCES : le select reflete le nouveau role, persiste en base.
    await expect(row.getByRole("combobox")).toHaveValue("AUDITOR");
    const membership = await getDb().orgMembership.findUnique({
      where: { userId_orgId: { userId: manager.id, orgId } },
    });
    expect(membership?.role).toBe("AUDITOR");
  });

  test("MANAGER POST /members -> 403", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "mem-rbac-mgr" });
    const manager = await createTestOrgMember({
      scope: "mem-rbac-mgr-user",
      orgId,
      role: "MANAGER",
    });
    await loginAs(page, manager);

    const res = await page.request.post(`/api/org/${orgId}/members`, {
      data: { email: `e2e-fail-${Date.now()}@v2-11-e2e.test`, name: "x", role: "AUDITOR" },
    });
    expect(res.status()).toBe(403);
  });

  test("AUDITOR POST /members -> 403", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "mem-rbac-aud" });
    const auditor = await createTestOrgMember({
      scope: "mem-rbac-aud-user",
      orgId,
      role: "AUDITOR",
    });
    await loginAs(page, auditor);

    const res = await page.request.post(`/api/org/${orgId}/members`, {
      data: { email: `e2e-fail2-${Date.now()}@v2-11-e2e.test`, name: "x", role: "AUDITOR" },
    });
    expect(res.status()).toBe(403);
  });

  test("MANAGER GET /api/org/[orgId]/members -> 200 (lecture autorisee)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "mem-rbac-read" });
    const manager = await createTestOrgMember({
      scope: "mem-rbac-read-user",
      orgId,
      role: "MANAGER",
    });
    await loginAs(page, manager);

    const res = await page.request.get(`/api/org/${orgId}/members`);
    expect(res.status()).toBe(200);
  });
});
