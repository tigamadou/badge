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
    await page.locator("form").getByLabel("Rôle").selectOption({ label: "Gestionnaire" });
    await page.getByRole("button", { name: /^inviter$/i }).click();

    // Effet UI : la ligne apparait apres le refresh du formulaire.
    await expect(page.getByText("UI Invitee")).toBeVisible();
    const row = page.locator("tr", { hasText: inviteeEmail });
    await expect(row.getByRole("combobox").locator("option:checked")).toHaveText("Gestionnaire");

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
    await page.locator("form").getByLabel("Rôle").selectOption({ label: "Auditeur" });
    await page.getByRole("button", { name: /^inviter$/i }).click();

    const row = page.locator("tr", { hasText: existing.email });
    await expect(row.getByRole("combobox").locator("option:checked")).toHaveText("Auditeur");

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

  
  test("Un OWNER ne modifie pas son propre role : badge sans select, et le dernier OWNER n'est pas retirable", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-last-demote" });
    await loginAndEnter(page, owner, { kind: "org", id: orgId });

    await page.getByRole("link", { name: /membres/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/members`));

    const row = page.locator("tr").filter({ hasText: owner.email });
    // Regle SELF_MODIFICATION : pas de select sur sa propre ligne ; le dernier OWNER n'a pas de bouton Retirer.
    await expect(row.getByRole("combobox")).toHaveCount(0);
    await expect(row.getByText("Propriétaire")).toBeVisible();
    await expect(row.getByText(/dernier OWNER/i)).toBeVisible();
    await expect(row.getByRole("button", { name: /^retirer$/i })).toHaveCount(0);
    const still = await getDb().orgMembership.findUnique({
      where: { userId_orgId: { userId: owner.id, orgId } },
    });
    expect(still?.role).toBe("OWNER");
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
    await row.getByRole("combobox").selectOption({ label: "Auditeur" });

    // Reponse attendue — SUCCES : le select reflete le nouveau role, persiste en base.
    await expect(row.getByRole("combobox").locator("option:checked")).toHaveText("Auditeur");
    const membership = await getDb().orgMembership.findUnique({
      where: { userId_orgId: { userId: manager.id, orgId } },
    });
    expect(membership?.role).toBe("AUDITOR");
  });

    test("MANAGER ne voit pas le formulaire d'invitation (OWNER-only)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "mem-mgr-noform" });
    const manager = await createTestOrgMember({
      scope: "mem-mgr-noform-user",
      orgId,
      role: "MANAGER",
    });
    await loginAndEnter(page, manager, { kind: "org", id: orgId });

    await page.getByRole("link", { name: /membres/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/members`));
    // La liste reste consultable, mais l'invitation est reservee a l'OWNER.
    await expect(page.getByRole("heading", { name: /^membres$/i })).toBeVisible();
    await expect(page.getByPlaceholder("email@exemple.fr")).toHaveCount(0);
  });

  test("AUDITOR ne voit pas l'entree Membres dans la nav", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "mem-aud-nonav" });
    const auditor = await createTestOrgMember({
      scope: "mem-aud-nonav-user",
      orgId,
      role: "AUDITOR",
    });
    await loginAndEnter(page, auditor, { kind: "org", id: orgId });

    await expect(page.getByRole("link", { name: /membres/i })).toHaveCount(0);
  });
});
