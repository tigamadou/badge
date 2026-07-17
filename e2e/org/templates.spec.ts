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

test.describe("T17 Org category templates", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("OWNER cree CategoryTemplate via API", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "tpl-create" });
    await loginAs(page, owner);

    const res = await request.post(`/api/org/${orgId}/templates`, {
      data: { name: "Tpl OWNER", color: "#FF5733", number: 1 },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.template?.id).toBeTruthy();

    await expectLastActivity({
      type: "CATEGORY_TEMPLATE_CREATED",
      orgId,
      userId: owner.id,
      targetId: json.template.id,
    });
  });

  // Note T00.1 : la POST templates est OWNER-only (source de verite : src/app/api/org/[orgId]/templates/route.ts).
  // La spec du plan indiquait "MANAGER cree CategoryTemplate" -- on adapte ici a la realite
  // du code : MANAGER ne peut PAS creer, le serveur retourne 403. Le cas RBAC est aussi
  // couvert dans rbac.spec.ts. Voir le livrable du rapport pour le flag.
  test("MANAGER tente de creer un CategoryTemplate -> 403", async ({ page, request }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "tpl-mgr-create" });
    const manager = await createTestOrgMember({
      scope: "tpl-mgr",
      orgId,
      role: "MANAGER",
    });
    await loginAs(page, manager);

    const res = await request.post(`/api/org/${orgId}/templates`, {
      data: { name: "Tpl MANAGER", color: "#00FF00", number: 5 },
    });
    expect(res.status()).toBe(403);
  });

  test("OWNER edite CategoryTemplate via PATCH", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "tpl-edit" });
    const tpl = await createTestCategoryTemplate({
      orgId,
      name: "Old name",
      color: "#000000",
      number: 7,
    });
    await loginAs(page, owner);

    const res = await request.patch(
      `/api/org/${orgId}/templates/${tpl.id}`,
      { data: { name: "New name", color: "#abcdef" } },
    );
    expect(res.status()).toBe(200);

    const db = getDb();
    const after = await db.categoryTemplate.findUnique({ where: { id: tpl.id } });
    expect(after?.name).toBe("New name");
    expect(after?.color).toBe("#abcdef");

    await expectLastActivity({
      type: "CATEGORY_TEMPLATE_UPDATED",
      orgId,
      userId: owner.id,
      targetId: tpl.id,
    });
  });

  test("OWNER supprime CategoryTemplate via DELETE", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "tpl-delete" });
    const tpl = await createTestCategoryTemplate({
      orgId,
      name: "To delete",
      color: "#123456",
      number: 8,
    });
    await loginAs(page, owner);

    const res = await request.delete(
      `/api/org/${orgId}/templates/${tpl.id}`,
    );
    expect(res.status()).toBe(204);

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

  test("UI /admin/[orgId]/templates affiche le tableau et permet de creer", async ({
    page,
  }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "tpl-ui" });
    await createTestCategoryTemplate({
      orgId,
      name: "Tpl visible",
      color: "#abcdef",
      number: 9,
    });
    await loginAs(page, owner);

    await page.goto(`/org/${orgId}/templates`);
    await expect(page.getByRole("heading", { name: /mod[èe]les de cat[ée]gories/i })).toBeVisible();
    await expect(page.getByText("Tpl visible")).toBeVisible();

    // Bouton "Nouveau modele" expose le form (inline) ; on verifie sa presence
    // sans necessairement soumettre (le form complet est couvert par les tests
    // API plus haut).
    await expect(page.getByRole("button", { name: /nouveau mod[èe]le/i })).toBeVisible();
  });
});
