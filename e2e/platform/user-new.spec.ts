import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";

// Page Nouvel utilisateur — /platform/users/new
// Rôle mini : STAFF_SUPPORT. Creer un STAFF exige STAFF_ADMIN ; creer un
// STAFF_ADMIN ou SUPER_ADMIN exige SUPER_ADMIN. Le compte cree recoit une
// invitation par e-mail.
test.describe("Platform — Nouvel utilisateur", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("STAFF_SUPPORT voit le formulaire", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "unew-render" });

    await page.goto("/platform/users/new");
    await expect(page.getByLabel(/Adresse e-mail/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /créer et inviter/i })).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("STAFF_SUPPORT cree un client rattache a une org (AUDITOR)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "unew-client" });
    const org = await getDb().organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "unew-client-actor" });
    await mailpit.clear();

    const email = `e2e-unew-client-${Date.now()}@v2-11-e2e.test`;

    await page.goto("/platform/users/new");
    await page.getByLabel(/Adresse e-mail/i).fill(email);
    await page.getByLabel(/Nom complet/i).fill("Client E2E");
    // "Client" est le type par defaut.
    await page.getByRole("combobox", { name: /organisation/i }).selectOption({ label: org!.name });
    await page
      .getByRole("combobox", { name: /rôle dans l.organisation/i })
      .selectOption("AUDITOR");
    await page.getByRole("button", { name: /créer et inviter/i }).click();

    await page.waitForURL(/\/platform\/users\/(?!new)[a-z0-9]+/i, { timeout: 10_000 });

    const dbUser = await getDb().user.findUnique({
      where: { email },
      select: { id: true, isStaff: true, staffRole: true },
    });
    expect(dbUser?.isStaff).toBe(false);
    expect(dbUser?.staffRole).toBeNull();

    const membership = await getDb().orgMembership.findFirst({
      where: { userId: dbUser!.id, orgId },
      select: { role: true },
    });
    expect(membership?.role).toBe("AUDITOR");

    await mailpit.expectMail({ to: email });
  });

  test("STAFF_ADMIN cree un membre du staff (STAFF_SUPPORT)", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "unew-staff-actor" });

    const email = `e2e-unew-staff-${Date.now()}@v2-11-e2e.test`;

    await page.goto("/platform/users/new");
    await page.getByLabel(/Adresse e-mail/i).fill(email);
    await page.getByLabel(/Nom complet/i).fill("Staff E2E");
    // RadioCards rend des <button role="radio"> : click() (check() ne declenche pas onClick).
    await page.getByRole("radio", { name: /staff applicatif/i }).click();
    // Le <label> englobe le <select> : son texte inclut les options, donc getByLabel
    // ne matche pas. La section "Rôle staff" n'expose qu'un seul select.
    await page.locator("select").selectOption("STAFF_SUPPORT");
    await page.getByRole("button", { name: /créer et inviter/i }).click();

    await page.waitForURL(/\/platform\/users\/(?!new)[a-z0-9]+/i, { timeout: 10_000 });

    const dbUser = await getDb().user.findUnique({
      where: { email },
      select: { isStaff: true, staffRole: true },
    });
    expect(dbUser?.isStaff).toBe(true);
    expect(dbUser?.staffRole).toBe("STAFF_SUPPORT");
  });

  // --- Gardes & API -------------------------------------------------------

});
