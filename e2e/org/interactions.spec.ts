import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestOrgMember,
  createTestCategoryTemplate,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

// Complete les specs org/*.spec.ts existantes (rbac, settings, templates,
// members, events) qui couvrent deja beaucoup d'effets metier via appels API
// directs (page.request.*). Ici on couvre les interactions UI reelles
// (formulaire/bouton/modale) qui n'etaient pas encore exercees : soumission
// des formulaires, clics de boutons, confirm() de suppression -- en assertant
// l'effet (BDD/audit/feedback). Pas de re-test du rendu simple (deja couvert
// par pages-render.spec.ts) ni des cas RBAC (deja couverts par rbac.spec.ts).

test.describe("T-UI Org interactions", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // -- Membres -----------------------------------------------------------

  test("OWNER invite un membre via le formulaire UI (role MANAGER)", async ({
    page,
  }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "ui-members-invite",
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/members`);
    await expect(page.getByRole("heading", { name: /^membres$/i })).toBeVisible();

    const inviteeEmail = `e2e-ui-invitee-${Date.now()}@v2-11-e2e.test`;
    await page.getByPlaceholder("Nom complet").fill("UI Invitee");
    await page.getByPlaceholder("email@exemple.fr").fill(inviteeEmail);
    // Le select "Rôle" par defaut est MANAGER -- on le fixe explicitement pour
    // rendre le test robuste a un changement de valeur par defaut du composant.
    await page.getByLabel("Rôle").selectOption("MANAGER");
    await page.getByRole("button", { name: /^inviter$/i }).click();

    // Effet UI : la ligne apparait dans le tableau apres le refresh() du formulaire.
    await expect(page.getByText("UI Invitee")).toBeVisible();
    const row = page.locator("tr", { hasText: inviteeEmail });
    await expect(row.getByText("MANAGER")).toBeVisible();

    const db = getDb();
    const created = await db.user.findUnique({
      where: { email: inviteeEmail },
      select: { id: true },
    });
    expect(created).not.toBeNull();
    const membership = await db.orgMembership.findUnique({
      where: { userId_orgId: { userId: created!.id, orgId } },
    });
    expect(membership?.role).toBe("MANAGER");

    await expectLastActivity({
      type: "MEMBERSHIP_ADDED",
      orgId,
      targetId: created!.id,
      userId: owner.id,
    });
  });

  test("OWNER retire un membre via le bouton Retirer", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "ui-members-remove",
    });
    const manager = await createTestOrgMember({
      scope: "ui-members-remove-target",
      orgId,
      role: "MANAGER",
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/members`);
    await expect(page.getByText(manager.email)).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    const row = page.locator("tr", { hasText: manager.email });
    await row.getByRole("button", { name: /^retirer$/i }).click();

    // Effet UI : la ligne disparait apres le refresh().
    await expect(page.getByText(manager.email)).toHaveCount(0);

    const db = getDb();
    const membership = await db.orgMembership.findUnique({
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

  test("Dernier OWNER : pas de bouton Retirer dans l'UI (etat protege)", async ({
    page,
  }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "ui-members-last-owner",
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/members`);
    const row = page.locator("tr", { hasText: owner.email });
    await expect(row.getByText(/dernier owner/i)).toBeVisible();
    await expect(row.getByRole("button", { name: /^retirer$/i })).toHaveCount(0);
  });

  // -- Settings org --------------------------------------------------------

  test("OWNER modifie les infos org via le formulaire UI", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "ui-settings-form",
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/settings`);
    await expect(
      page.getByRole("heading", { name: /paramètres de l.organisation/i }),
    ).toBeVisible();

    const newName = "E2E Org via formulaire UI";
    await page.getByRole("textbox", { name: "Nom" }).fill(newName);
    await page.getByLabel("Ville").fill("Yamoussoukro");
    await page.getByLabel("E-mail de contact").fill("ui-contact@e2e.test");
    await page.getByRole("button", { name: /^enregistrer$/i }).click();

    await expect(page.getByText(/paramètres enregistrés/i)).toBeVisible();

    const db = getDb();
    const updated = await db.organization.findUnique({ where: { id: orgId } });
    expect(updated?.name).toBe(newName);
    expect(updated?.city).toBe("Yamoussoukro");
    expect(updated?.contactEmail).toBe("ui-contact@e2e.test");

    await expectLastActivity({
      type: "ORG_UPDATED",
      orgId,
      userId: owner.id,
    });
  });

  // -- Settings badge --------------------------------------------------------

  test("OWNER selectionne un template de badge via l'UI", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "ui-settings-badge",
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/settings/badge`);
    await expect(
      page.getByRole("heading", { name: /modèle de badge/i }),
    ).toBeVisible();

    await page.getByTestId("select-recto-verso-v1").click();
    await expect(page.getByTestId("save-success")).toBeVisible();
    await expect(
      page.locator('[data-testid="template-card-recto-verso-v1"][data-selected="true"]'),
    ).toBeVisible();

    const db = getDb();
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { badgeTemplateId: true },
    });
    expect(org?.badgeTemplateId).toBe("recto-verso-v1");

    const log = await expectLastActivity({
      type: "ORG_UPDATED",
      orgId,
      userId: owner.id,
    });
    const details = log.details as { field?: string; value?: string } | null;
    expect(details?.field).toBe("badgeTemplateId");
    expect(details?.value).toBe("recto-verso-v1");
  });

  // -- Category templates ----------------------------------------------------

  test("OWNER cree un CategoryTemplate via le formulaire UI (modale)", async ({
    page,
  }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "ui-tpl-create",
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/templates`);
    await page.getByRole("button", { name: /^ajouter$/i }).click();
    await expect(
      page.getByRole("heading", { name: /nouveau modèle/i }),
    ).toBeVisible();

    await page.getByRole("textbox", { name: "Nom" }).fill("Presse UI");
    await page.getByLabel("Numéro").fill("42");
    await page.getByRole("button", { name: /^créer$/i }).click();

    // Effet UI : la modale se ferme (refresh()) et la ligne apparait.
    await expect(
      page.getByRole("heading", { name: /nouveau modèle/i }),
    ).toHaveCount(0);
    await expect(page.getByText("Presse UI")).toBeVisible();

    const db = getDb();
    const tpl = await db.categoryTemplate.findFirst({
      where: { orgId, name: "Presse UI" },
    });
    expect(tpl).not.toBeNull();
    expect(tpl?.number).toBe(42);

    await expectLastActivity({
      type: "CATEGORY_TEMPLATE_CREATED",
      orgId,
      userId: owner.id,
      targetId: tpl!.id,
    });
  });

  test("OWNER edite un CategoryTemplate via le formulaire UI (modale)", async ({
    page,
  }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "ui-tpl-edit" });
    const tpl = await createTestCategoryTemplate({
      orgId,
      name: "Nom initial UI",
      color: "#111111",
      number: 20,
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/templates`);
    const row = page.locator("tr", { hasText: "Nom initial UI" });
    await row.getByRole("button", { name: /éditer/i }).click();
    await expect(
      page.getByRole("heading", { name: /modifier le modèle/i }),
    ).toBeVisible();

    const nameInput = page.getByRole("textbox", { name: "Nom" });
    await nameInput.fill("Nom modifie UI");
    await page.getByRole("button", { name: /^enregistrer$/i }).click();

    await expect(page.getByText("Nom modifie UI")).toBeVisible();
    await expect(page.getByText("Nom initial UI")).toHaveCount(0);

    const db = getDb();
    const after = await db.categoryTemplate.findUnique({ where: { id: tpl.id } });
    expect(after?.name).toBe("Nom modifie UI");

    await expectLastActivity({
      type: "CATEGORY_TEMPLATE_UPDATED",
      orgId,
      userId: owner.id,
      targetId: tpl.id,
    });
  });

  test("OWNER supprime un CategoryTemplate via le bouton Supprimer", async ({
    page,
  }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "ui-tpl-delete",
    });
    const tpl = await createTestCategoryTemplate({
      orgId,
      name: "A supprimer UI",
      color: "#222222",
      number: 21,
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/templates`);
    await expect(page.getByText("A supprimer UI")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    const row = page.locator("tr", { hasText: "A supprimer UI" });
    await row.getByRole("button", { name: /supprimer/i }).click();

    await expect(page.getByText("A supprimer UI")).toHaveCount(0);

    const db = getDb();
    const after = await db.categoryTemplate.findUnique({ where: { id: tpl.id } });
    expect(after).toBeNull();

    await expectLastActivity({
      type: "CATEGORY_TEMPLATE_DELETED",
      orgId,
      userId: owner.id,
      targetId: tpl.id,
    });
  });

  test("Etat vide : aucun CategoryTemplate affiche le message vide", async ({
    page,
  }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "ui-tpl-empty",
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/templates`);
    await expect(page.getByText(/aucun modèle/i)).toBeVisible();
  });
});
