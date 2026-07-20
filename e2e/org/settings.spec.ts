import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestOrgMember,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { loginAndEnter } from "../helpers/nav";
import { expectLastActivity } from "../helpers/audit";
import { ensureFixtures } from "../fixtures";

// Page Parametres — /org/[orgId]/settings et /org/[orgId]/settings/badge
// /settings : nav OWNER, mais la PAGE n'a aucune garde de role — un MANAGER ou un
//   AUDITOR qui connait l'URL voit le formulaire ; la mutation (PATCH) est OWNER-only.
// /settings/badge : garde MANAGER dans la page (AUDITOR redirige).
test.describe("Org — Parametres", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ------------------------------------------------------

  test("OWNER voit le formulaire de parametres", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "set-render" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/settings`);
    await expect(
      page.getByRole("heading", { name: /paramètres de l.organisation/i }),
    ).toBeVisible();
    // Le slug est staff-only : affiche mais desactive.
    await expect(page.getByLabel("Slug")).toBeDisabled();
  });

  test("OWNER voit la page Modele de badge", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "set-badge-render" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/settings/badge`);
    await expect(page.getByRole("heading", { name: /modèle de badge/i })).toBeVisible();
  });

  // --- Actions UI ---------------------------------------------------------

  test("OWNER modifie les infos org via le formulaire", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "set-form" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/settings`);
    const newName = "E2E Org via formulaire UI";
    await page.getByRole("textbox", { name: "Nom" }).fill(newName);
    await page.getByLabel("Ville").fill("Yamoussoukro");
    await page.getByLabel("E-mail de contact").fill("ui-contact@e2e.test");
    await page.getByRole("button", { name: /^enregistrer$/i }).click();

    await expect(page.getByText(/paramètres enregistrés/i)).toBeVisible();

    const updated = await getDb().organization.findUnique({ where: { id: orgId } });
    expect(updated?.name).toBe(newName);
    expect(updated?.city).toBe("Yamoussoukro");
    expect(updated?.contactEmail).toBe("ui-contact@e2e.test");

    await expectLastActivity({ type: "ORG_UPDATED", orgId, userId: owner.id });
  });

  test("OWNER televerse un logo via le Dropzone", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "set-logo" });
    const fixtures = ensureFixtures();
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/settings`);
    await page.locator('input[type="file"]').first().setInputFiles(fixtures.jpeg);

    // Une fois televerse, le fichier est affiche avec un bouton Retirer.
    await expect(page.getByRole("button", { name: /retirer/i })).toBeVisible();
  });

  test("OWNER selectionne un template de badge via l'UI", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "set-badge-pick" });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/settings/badge`);
    await page.getByTestId("select-recto-verso-v1").click();
    await expect(page.getByTestId("save-success")).toBeVisible();
    await expect(
      page.locator('[data-testid="template-card-recto-verso-v1"][data-selected="true"]'),
    ).toBeVisible();

    const org = await getDb().organization.findUnique({
      where: { id: orgId },
      select: { badgeTemplateId: true },
    });
    expect(org?.badgeTemplateId).toBe("recto-verso-v1");

    const log = await expectLastActivity({ type: "ORG_UPDATED", orgId, userId: owner.id });
    const details = log.details as { field?: string; value?: string } | null;
    expect(details?.field).toBe("badgeTemplateId");
    expect(details?.value).toBe("recto-verso-v1");
  });

  // --- Gardes & API -------------------------------------------------------

  test("OWNER revient au modele herite via le bouton dedie", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "set-badge-reset" });
    await loginAndEnter(page, owner, { kind: "org", id: orgId });

    await page.goto(`/org/${orgId}/settings/badge`);
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/settings/badge`));

    // 1. Choisir un modele explicite.
    await page.getByTestId("select-recto-verso-v1").click();
    await expect(page.getByTestId("save-success")).toBeVisible();
    expect(
      (await getDb().organization.findUnique({ where: { id: orgId }, select: { badgeTemplateId: true } }))
        ?.badgeTemplateId,
    ).toBe("recto-verso-v1");

    // 2. Revenir a l'heritage : reponse attendue = succes affiche + valeur nulle.
    await page.getByRole("button", { name: /défaut hérité/i }).click();
    await expect(page.getByTestId("save-success")).toBeVisible();
    expect(
      (await getDb().organization.findUnique({ where: { id: orgId }, select: { badgeTemplateId: true } }))
        ?.badgeTemplateId,
    ).toBeNull();
  });

  
  
  test("MANAGER voit la page Parametres (mutation refusee cote API)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "set-mgr" });
    const manager = await createTestOrgMember({ scope: "set-mgr-user", orgId, role: "MANAGER" });
    await loginAs(page, manager);

    // La page /settings n'a pas de garde : le formulaire est visible.
    await page.goto(`/org/${orgId}/settings`);
    await expect(
      page.getByRole("heading", { name: /paramètres de l.organisation/i }),
    ).toBeVisible();

    // La mutation reste refusee cote API (garde couverte en integration).
  });

  test("MANAGER choisit un modele de badge via l'UI (autorise)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "set-mgr-badge" });
    const manager = await createTestOrgMember({
      scope: "set-mgr-badge-user",
      orgId,
      role: "MANAGER",
    });
    await loginAndEnter(page, manager, { kind: "org", id: orgId });

    await page.goto(`/org/${orgId}/settings/badge`);
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/settings/badge`));
    await page.getByTestId("select-recto-verso-v1").click();

    // Reponse attendue — SUCCES : le MANAGER est autorise sur le badge.
    await expect(page.getByTestId("save-success")).toBeVisible();
    expect(
      (await getDb().organization.findUnique({ where: { id: orgId }, select: { badgeTemplateId: true } }))
        ?.badgeTemplateId,
    ).toBe("recto-verso-v1");
  });

  
  test("AUDITOR est redirige depuis /settings/badge (garde MANAGER)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "set-badge-aud-page" });
    const auditor = await createTestOrgMember({
      scope: "set-badge-aud-page-user",
      orgId,
      role: "AUDITOR",
    });
    await loginAs(page, auditor);

    await page.goto(`/org/${orgId}/settings/badge`);
    await page.waitForURL(`**/org/${orgId}`);
    await expect(page.getByRole("heading", { name: /modèle de badge/i })).toHaveCount(0);
  });
});
