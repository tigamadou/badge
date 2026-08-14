import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, disconnectDb, getDb } from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity } from "../helpers/audit";

// Page Nouvelle organisation — /platform/organizations/new
// Rôle : STAFF_ADMIN. Le slug est genere automatiquement depuis le nom (lecture
// seule) ; le serveur garantit l'unicite en suffixant -2, -3...
// La creation invite aussi l'OWNER initial par e-mail.
test.describe("Platform — Nouvelle organisation", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Actions UI ---------------------------------------------------------

  test("STAFF_ADMIN cree une org et invite l'OWNER", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "orgnew-create" });
    await mailpit.clear();

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const ownerEmail = `e2e-orgowner-${suffix}@v2-11-e2e.test`;
    const orgName = `Acme E2E ${suffix}`;

    await page.goto("/platform/organizations/new");
    await page.getByLabel(/Nom de l'organisation/i).fill(orgName);
    await page.getByLabel(/E-mail du OWNER/i).fill(ownerEmail);
    await page.getByLabel(/Nom complet du OWNER/i).fill("Awa OWNER");
    await page.getByRole("button", { name: /créer l'organisation/i }).click();

    // Redirection vers la fiche de l'org creee.
    await page.waitForURL(/\/platform\/organizations\/(?!new$)[a-z0-9-]+$/i, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: orgName })).toBeVisible();

    const org = await getDb().organization.findFirst({
      where: { name: orgName },
      select: { id: true, slug: true },
    });
    expect(org).not.toBeNull();

    const owner = await getDb().user.findUnique({
      where: { email: ownerEmail },
      select: { id: true },
    });
    expect(owner).not.toBeNull();

    const membership = await getDb().orgMembership.findFirst({
      where: { orgId: org!.id, userId: owner!.id },
      select: { role: true },
    });
    expect(membership?.role).toBe("OWNER");

    await mailpit.expectMail({
      to: ownerEmail,
      subjectPattern: /bienvenue|invitation/i,
      timeoutMs: 8000,
    });

    await expectLastActivity({ type: "ORG_CREATED", orgId: org!.id });
    expect(
      await getDb().activityLog.findFirst({ where: { type: "USER_CREATED", targetId: owner!.id } }),
    ).not.toBeNull();
    expect(
      await getDb().activityLog.findFirst({
        where: { type: "MEMBERSHIP_ADDED", orgId: org!.id, targetId: owner!.id },
      }),
    ).not.toBeNull();
  });

  // --- Gardes & API -------------------------------------------------------

});
