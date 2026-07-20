import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestEvent,
  createTestUser,
  makeEventAdminUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAndEnter } from "../helpers/nav";
import { createTestEventMember } from "../helpers/db";
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity } from "../helpers/audit";

// Page Membres — /event/[eventId]/members
// Rôle : ADMIN. Actions : inviter (formulaire), changer le role (select inline),
// retirer (bouton). Roles event : ADMIN / OPERATOR / PRINTER / VIEWER.
test.describe("Event — Membres", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("ADMIN invite un nouvel OPERATOR via le formulaire", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "members-invite-new" });
    const admin = await makeEventAdminUser({ scope: "members-invite-new", eventId, orgId });
    await mailpit.clear();
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.getByRole("link", { name: /membres/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/members`));

    const inviteEmail = `e2e-invite-new-${Date.now()}@v2-11-e2e.test`;
    await page.getByRole("button", { name: /^inviter$/i }).click();
    await page.getByPlaceholder("Email").fill(inviteEmail);
    await page.getByPlaceholder(/Nom/).fill("Mariam Kone");
    await page.locator("form").locator("select").selectOption("OPERATOR");
    await page.getByRole("button", { name: /^inviter$/i }).last().click();

    // Reponse attendue — SUCCES : la ligne apparait, user + membership crees, mail envoye.
    await expect(page.getByText(inviteEmail)).toBeVisible();
    const created = await getDb().user.findUnique({ where: { email: inviteEmail } });
    expect(created).not.toBeNull();
    const membership = await getDb().eventMembership.findFirst({
      where: { eventId, userId: created!.id },
    });
    expect(membership?.role).toBe("OPERATOR");
    await expectLastActivity({ type: "MEMBERSHIP_ADDED", eventId, targetId: created!.id });
    await mailpit.expectMail({ to: inviteEmail, subjectPattern: /bienvenue/i });
  });

  test("ADMIN retire un membre via le bouton", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "members-remove" });
    const admin = await makeEventAdminUser({
      scope: "members-remove",
      eventId,
      orgId,
    });

    // Cree un membre a retirer.
    const target = await createTestUser({ scope: "members-target", verified: true });
    const membership = await getDb().eventMembership.create({
      data: { userId: target.id, eventId, role: "PRINTER" },
    });

    await loginAndEnter(page, admin, { kind: "event", id: eventId });
    await page.getByRole("link", { name: /membres/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/members`));
    await expect(page.getByText(target.email)).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page
      .locator("tr", { hasText: target.email })
      .getByRole("button", { name: /retirer/i })
      .click();

    // Reponse attendue — SUCCES : la ligne disparait, membership supprime.
    await expect(page.getByText(target.email)).toHaveCount(0);
    expect(await getDb().eventMembership.findUnique({ where: { id: membership.id } })).toBeNull();
    await expectLastActivity({
      type: "MEMBERSHIP_REMOVED",
      userId: admin.id,
      eventId,
      targetId: target.id,
    });
  });

  test("UI : members page displays table with name/email/role columns", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "members-ui" });
    const admin = await makeEventAdminUser({ scope: "members-ui", eventId, orgId });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    // Seed quelques membres pour rendre la table non-vide.
    const m1 = await createTestUser({ scope: "ui-m1", verified: true });
    await getDb().eventMembership.create({
      data: { userId: m1.id, eventId, role: "OPERATOR" },
    });

    await page.goto(`/event/${eventId}/members`);
    await expect(page.getByRole("heading", { name: /membres/i })).toBeVisible();
    // En-tetes attendues (colonne "Membre" regroupe nom+email, plus de colonnes separees).
    await expect(page.getByRole("columnheader", { name: /membre/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /rôle/i })).toBeVisible();
    // Ligne du membre seede visible.
    await expect(page.getByText(m1.email)).toBeVisible();
  });

  test("ADMIN change le role d'un membre via le select inline", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "mem-role" });
    const admin = await makeEventAdminUser({ scope: "mem-role", eventId, orgId });
    const member = await createTestEventMember({
      scope: "mem-role-target",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    await loginAndEnter(page, admin, { kind: "event", id: eventId });

    await page.goto(`/event/${eventId}/members`);
    const row = page.locator("tr", { hasText: member.email });
    await row.locator("select").selectOption("PRINTER");

    await expect(async () => {
      const membership = await getDb().eventMembership.findFirst({
        where: { eventId, userId: member.id },
      });
      expect(membership?.role).toBe("PRINTER");
    }).toPass();
  });

  test("OPERATOR ne voit pas l'entree Membres dans son shell", async ({ page }) => {
    const { orgId, eventId } = await createTestEvent({ scope: "mem-operator" });
    const operator = await createTestEventMember({
      scope: "mem-operator-user",
      orgId,
      eventId,
      role: "OPERATOR",
    });
    await loginAndEnter(page, operator, { kind: "event", id: eventId });

    // Le shell OPERATOR n'expose que le scanner : pas d'entree Membres.
    await expect(page.getByRole("link", { name: /membres/i })).toHaveCount(0);
  });
});
