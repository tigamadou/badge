import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

// Page Fiche organisation — /platform/organizations/[orgId]
// Rôle mini : STAFF_OBSERVER (supervision). Zone de danger : Archiver / Restaurer
// (STAFF_ADMIN) et Supprimer definitivement (SUPER_ADMIN uniquement, modale avec
// saisie du slug exact + header x-confirm).
// Note : PATCH org (nom/contact/slug) n'a AUCUN formulaire ici — couvert en Vitest.
test.describe("Platform — Fiche organisation", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("STAFF_OBSERVER voit la fiche et ses cartes", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pdet-render", maxEvents: 5 });
    const org = await getDb().organization.findUnique({ where: { id: orgId } });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "pdet-render-staff" });

    await page.goto(`/platform/organizations/${orgId}`);
    await expect(page.getByText(org!.name).first()).toBeVisible();
    await expect(page.getByText(/abonnement/i).first()).toBeVisible();
    await expect(page.getByText(/organisation introuvable/i)).toHaveCount(0);
  });

  test("Organisation introuvable -> 404", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pdet-404" });

    const res = await page.goto("/platform/organizations/org-inexistant-e2e");
    expect(res?.status()).toBe(404);
  });

  // --- Actions UI : zone de danger ----------------------------------------

  test("STAFF_ADMIN archive puis restaure via les boutons", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pdet-archive" });
    const staff = await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pdet-archive-staff" });

    await page.goto(`/platform/organizations/${orgId}`);
    await page.getByRole("button", { name: /^archiver$/i }).click();

    await expect(async () => {
      const org = await getDb().organization.findUnique({ where: { id: orgId } });
      expect(org?.archived).toBe(true);
    }).toPass();
    await expectLastActivity({ type: "ORG_ARCHIVED", orgId, userId: staff.id });

    // Le bouton bascule sur "Restaurer".
    await page.getByRole("button", { name: /^restaurer$/i }).click();
    await expect(async () => {
      const org = await getDb().organization.findUnique({ where: { id: orgId } });
      expect(org?.archived).toBe(false);
    }).toPass();
    await expectLastActivity({ type: "ORG_RESTORED", orgId, userId: staff.id });
  });

  test("SUPER_ADMIN supprime via la modale (slug exact exige)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pdet-delete" });
    const org = await getDb().organization.findUnique({ where: { id: orgId } });
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "pdet-delete-staff" });

    await page.goto(`/platform/organizations/${orgId}`);
    await page.getByRole("button", { name: /supprimer définitivement/i }).first().click();
    await expect(
      page.getByRole("heading", { name: /supprimer définitivement l'organisation/i }),
    ).toBeVisible();

    // Un slug errone est refuse.
    await page.getByPlaceholder(org!.slug).fill("mauvais-slug");
    await page
      .getByRole("button", { name: /supprimer définitivement/i })
      .last()
      .click();
    await expect(page.getByText(/confirmation invalide/i)).toBeVisible();
    expect(await getDb().organization.findUnique({ where: { id: orgId } })).not.toBeNull();

    // Le slug exact declenche la suppression.
    await page.getByPlaceholder(org!.slug).fill(org!.slug);
    await page
      .getByRole("button", { name: /supprimer définitivement/i })
      .last()
      .click();

    await expect(async () => {
      expect(await getDb().organization.findUnique({ where: { id: orgId } })).toBeNull();
    }).toPass();
  });

  test("STAFF_ADMIN ne voit pas le bouton de suppression definitive", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pdet-nodelete" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pdet-nodelete-staff" });

    await page.goto(`/platform/organizations/${orgId}`);
    await expect(page.getByRole("button", { name: /supprimer définitivement/i })).toHaveCount(0);
  });

  // --- Gardes & API -------------------------------------------------------

  test("STAFF_ADMIN -> 403 sur la suppression definitive", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pdet-api-delete" });
    const org = await getDb().organization.findUnique({ where: { id: orgId } });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "pdet-api-delete-staff" });

    const res = await page.request.delete(`/api/platform/organizations/${orgId}`, {
      headers: { "x-confirm": `delete-${org!.slug}` },
      data: { confirmSlug: org!.slug },
    });
    expect(res.status()).toBe(403);
  });

  test("STAFF_OBSERVER -> 403 sur l'archivage", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "pdet-obs-archive" });
    await loginAsStaff(page, { role: "STAFF_OBSERVER", scope: "pdet-obs-archive-staff" });

    const res = await page.request.post(`/api/platform/organizations/${orgId}/archive`);
    expect(res.status()).toBe(403);
  });
});
