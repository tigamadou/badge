import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestOrgMember,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
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

  test("PATCH badge template puis reset a null (heritage)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "set-badge-null" });
    await loginAs(page, owner);

    await page.request.patch(`/api/org/${orgId}/settings/badge`, {
      data: { badgeTemplateId: "default-v1" },
    });
    const res = await page.request.patch(`/api/org/${orgId}/settings/badge`, {
      data: { badgeTemplateId: null },
    });
    expect(res.status()).toBe(200);

    const org = await getDb().organization.findUnique({
      where: { id: orgId },
      select: { badgeTemplateId: true },
    });
    expect(org?.badgeTemplateId).toBeNull();
  });

  test("Template inconnu -> 400 UNKNOWN_TEMPLATE", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "set-badge-unknown" });
    await loginAs(page, owner);

    const res = await page.request.patch(`/api/org/${orgId}/settings/badge`, {
      data: { badgeTemplateId: "inexistant-v9" },
    });
    expect(res.status()).toBe(400);
  });

  test("Payload SMTP rejete sur PATCH /api/org/[orgId] -> 400", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "set-smtp" });
    await loginAs(page, owner);

    const res = await page.request.patch(`/api/org/${orgId}`, {
      data: { smtpHost: "smtp.example.com" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
  });

  test("MANAGER voit la page mais ne peut pas editer -> 403", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "set-mgr" });
    const manager = await createTestOrgMember({ scope: "set-mgr-user", orgId, role: "MANAGER" });
    await loginAs(page, manager);

    // La page /settings n'a pas de garde : le formulaire est visible.
    await page.goto(`/org/${orgId}/settings`);
    await expect(
      page.getByRole("heading", { name: /paramètres de l.organisation/i }),
    ).toBeVisible();

    // Mais la mutation est refusee.
    const res = await page.request.patch(`/api/org/${orgId}`, {
      data: { name: "Tentative MANAGER" },
    });
    expect(res.status()).toBe(403);
  });

  test("MANAGER PATCH /settings/badge -> 200 (autorise)", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "set-badge-mgr" });
    const manager = await createTestOrgMember({
      scope: "set-badge-mgr-user",
      orgId,
      role: "MANAGER",
    });
    await loginAs(page, manager);

    const res = await page.request.patch(`/api/org/${orgId}/settings/badge`, {
      data: { badgeTemplateId: "default-v1" },
    });
    expect(res.status()).toBe(200);
  });

  test("AUDITOR PATCH /settings/badge -> 403", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "set-badge-aud" });
    const auditor = await createTestOrgMember({
      scope: "set-badge-aud-user",
      orgId,
      role: "AUDITOR",
    });
    await loginAs(page, auditor);

    const res = await page.request.patch(`/api/org/${orgId}/settings/badge`, {
      data: { badgeTemplateId: "default-v1" },
    });
    expect(res.status()).toBe(403);
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
