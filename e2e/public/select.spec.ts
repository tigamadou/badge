import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs, loginAsStaff } from "../helpers/auth";

// Page Selecteur d'espace — /select
// Dispatcher post-login : liste les espaces accessibles (plateforme, orgs, events).
// Redirige automatiquement s'il n'y a qu'une seule cible.
test.describe("Public — Selecteur d'espace", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("Membre de 2 orgs : le selecteur liste les espaces", async ({ page }) => {
    const { orgId: orgIdA, owner: user } = await createTestOrgWithOwner({ scope: "sel-a" });
    const { orgId: orgIdB } = await createTestOrgWithOwner({ scope: "sel-b" });
    // Rattache le meme user a la 2e org : sans cela /select redirige direct.
    await getDb().orgMembership.create({
      data: { userId: user.id, orgId: orgIdB, role: "MANAGER" },
    });
    await loginAs(page, user);

    await page.goto("/select");
    await expect(page.getByRole("heading", { name: /choisissez un espace/i })).toBeVisible();

    const orgA = await getDb().organization.findUnique({
      where: { id: orgIdA },
      select: { name: true },
    });
    await expect(page.getByText(orgA!.name)).toBeVisible();
  });

  test("Une seule cible : redirection automatique vers l'org", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "sel-single" });
    await loginAs(page, owner);

    await page.goto("/select");
    await page.waitForURL(`**/org/${orgId}`);
  });

  test("Staff : le selecteur propose l'espace plateforme", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "sel-staff-org" });
    const staff = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "sel-staff" });
    expect(staff.id).toBeTruthy();
    expect(orgId).toBeTruthy();

    await page.goto("/select");
    // Un staff sans membership org n'a que la cible plateforme : redirection directe.
    await page.waitForURL(/\/platform/);
  });
});
