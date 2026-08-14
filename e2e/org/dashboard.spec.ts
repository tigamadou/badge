import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestOrgMember,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

// Page Tableau de bord — /org/[orgId]
// Rôle mini : AUDITOR (layout). Page 100% lecture seule : KPI, banniere de quota,
// liste des derniers evenements, timeline d'activite. Aucune mutation.
test.describe("Org — Tableau de bord", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  async function seedEvents(orgId: string, count: number, archived = false) {
    for (let i = 0; i < count; i++) {
      await getDb().event.create({
        data: {
          orgId,
          title: `E2E Event ${i}`,
          slug: `e2e-dash-${Date.now()}-${i}-${Math.floor(Math.random() * 1e6)}`,
          location: "Abidjan",
          date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          archived,
        },
      });
    }
  }

  // --- Acces & rendu ------------------------------------------------------

  test("OWNER voit les KPI du tableau de bord", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "dash-render", maxEvents: 10 });
    await seedEvents(orgId, 2);
    await seedEvents(orgId, 1, true);
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}`);
    await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible();
    await expect(page.getByText("Événements actifs")).toBeVisible();
    await expect(page.getByText("Événements archivés")).toBeVisible();
    await expect(page.getByText("Inscriptions ce mois")).toBeVisible();
    // Quota affiche "actifs / max".
    await expect(page.getByText("2 / 10")).toBeVisible();
  });

  test("AUDITOR voit aussi le tableau de bord (role minimal)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "dash-aud" });
    const auditor = await createTestOrgMember({
      scope: "dash-aud-user",
      orgId,
      role: "AUDITOR",
    });
    await loginAs(page, auditor);

    await page.goto(`/org/${orgId}`);
    await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible();
  });

  // --- Etats --------------------------------------------------------------

  test("Etat vide : aucun evenement, aucune activite", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "dash-empty" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}`);
    await expect(page.getByText(/aucun evenement|aucun événement/i).first()).toBeVisible();
  });

  test("Quota > 80% : banniere d'avertissement affichee", async ({ page }) => {
    // 9 events actifs sur un plan a 10 => 90% > 80%.
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "dash-quota", maxEvents: 10 });
    await seedEvents(orgId, 9);
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}`);
    await expect(page.getByText(/quota dépasse 80/i)).toBeVisible();
  });

  test("Quota sous le seuil : pas de banniere", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "dash-noquota", maxEvents: 10 });
    await seedEvents(orgId, 2);
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}`);
    await expect(page.getByText(/quota dépasse 80/i)).toHaveCount(0);
  });

  test("Plan illimite : quota affiche un tiret, pas de banniere", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "dash-illimite" });
    await seedEvents(orgId, 3);
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}`);
    await expect(page.getByText(/quota dépasse 80/i)).toHaveCount(0);
    await expect(page.getByText("Quota événements")).toBeVisible();
  });

  // --- Navigation ---------------------------------------------------------

  test("Le lien 'Tout voir' mene a la liste des evenements", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "dash-link" });
    await seedEvents(orgId, 1);
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}`);
    await page.getByRole("link", { name: /tout voir/i }).first().click();
    await page.waitForURL(`**/org/${orgId}/events`);
  });
});
