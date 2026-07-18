import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity } from "../helpers/audit";

test.describe("Staff > organizations CRUD", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("STAFF_ADMIN cree une org avec invitation OWNER", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "orgs-create" });
    await mailpit.clear();

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const ownerEmail = `e2e-orgowner-${suffix}@v2-11-e2e.test`;
    const orgName = `Acme E2E ${suffix}`;

    await page.goto("/platform/organizations/new");
    await page.getByLabel(/Nom de l'organisation/i).fill(orgName);
    await page.getByLabel(/Email du OWNER/i).fill(ownerEmail);
    await page.getByLabel(/Nom complet du OWNER/i).fill("Awa OWNER");
    await page.getByRole("button", { name: /creer l'organisation/i }).click();

    // Le form redirige vers /platform/organizations/[orgId] apres succes.
    await page.waitForURL(/\/platform\/organizations\/[a-z0-9-]+/i, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: orgName })).toBeVisible();

    // BDD : org + user OWNER + OrgMembership.
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

    // Mail d'invitation envoye via Mailpit.
    await mailpit.expectMail({
      to: ownerEmail,
      subjectPattern: /bienvenue|invitation/i,
      timeoutMs: 8000,
    });

    // Audit principal : ORG_CREATED.
    await expectLastActivity({ type: "ORG_CREATED", orgId: org!.id });
    // Audit secondaire : USER_CREATED + MEMBERSHIP_ADDED ciblant le nouveau OWNER.
    const userCreated = await getDb().activityLog.findFirst({
      where: { type: "USER_CREATED", targetId: owner!.id },
    });
    expect(userCreated).not.toBeNull();
    const membershipAdded = await getDb().activityLog.findFirst({
      where: { type: "MEMBERSHIP_ADDED", orgId: org!.id, targetId: owner!.id },
    });
    expect(membershipAdded).not.toBeNull();
  });

  test("STAFF_ADMIN met a jour name + contactEmail via PATCH API", async ({ page }) => {
    // Note : v2-13 n'a pas de form UI d'edition org dans /platform/organizations/[orgId]
    // (la page est read-only + actions archive/restore/delete). On exerce donc
    // l'endpoint PATCH /api/platform/organizations/[orgId] directement.
    const { orgId } = await createTestOrgWithOwner({ scope: "orgs-update" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "orgs-update" });

    const newName = `Acme E2E Updated ${Date.now()}`;
    const newEmail = `e2e-contact-${Date.now()}@v2-11-e2e.test`;
    const res = await page.request.patch(`/api/platform/organizations/${orgId}`, {
      data: { name: newName, contactEmail: newEmail },
    });
    expect(res.status()).toBe(200);

    const dbOrg = await getDb().organization.findUnique({
      where: { id: orgId },
      select: { name: true, contactEmail: true },
    });
    expect(dbOrg?.name).toBe(newName);
    expect(dbOrg?.contactEmail).toBe(newEmail);

    // UI : la page detail doit refleter le nouveau nom.
    await page.goto(`/platform/organizations/${orgId}`);
    await expect(page.getByRole("heading", { name: newName })).toBeVisible();
    await expect(page.getByText(newEmail)).toBeVisible();

    await expectLastActivity({ type: "ORG_UPDATED", orgId });
  });

  test("STAFF_ADMIN archive puis restaure une org", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "orgs-archive" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "orgs-archive" });

    const archiveRes = await page.request.post(
      `/api/platform/organizations/${orgId}/archive`,
    );
    expect(archiveRes.status()).toBe(200);
    let dbOrg = await getDb().organization.findUnique({
      where: { id: orgId },
      select: { archived: true, archivedAt: true },
    });
    expect(dbOrg?.archived).toBe(true);
    expect(dbOrg?.archivedAt).not.toBeNull();
    await expectLastActivity({ type: "ORG_ARCHIVED", orgId });

    const restoreRes = await page.request.post(
      `/api/platform/organizations/${orgId}/restore`,
    );
    expect(restoreRes.status()).toBe(200);
    dbOrg = await getDb().organization.findUnique({
      where: { id: orgId },
      select: { archived: true, archivedAt: true },
    });
    expect(dbOrg?.archived).toBe(false);
    expect(dbOrg?.archivedAt).toBeNull();
    await expectLastActivity({ type: "ORG_RESTORED", orgId });
  });

  test("SUPER_ADMIN hard delete avec confirmation", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "orgs-delete" });
    const org = await getDb().organization.findUnique({
      where: { id: orgId },
      select: { slug: true },
    });
    expect(org?.slug).toBeTruthy();

    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "orgs-delete" });

    // Tentative sans header de confirmation : 400.
    const noConfirm = await page.request.delete(`/api/platform/organizations/${orgId}`);
    expect(noConfirm.status()).toBe(400);

    // Tentative avec confirmation correcte : 204 + org disparait.
    const ok = await page.request.delete(`/api/platform/organizations/${orgId}`, {
      headers: { "x-confirm": `delete-${org!.slug}` },
    });
    expect(ok.status()).toBe(204);

    const after = await getDb().organization.findUnique({ where: { id: orgId } });
    expect(after).toBeNull();
  });

  test("Slug collision sur creation : auto-increment", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "orgs-slug" });

    const baseSlug = `e2e-collision-${Date.now()}`;
    const ownerEmail1 = `e2e-coll1-${Date.now()}@v2-11-e2e.test`;
    const res1 = await page.request.post("/api/platform/organizations", {
      data: {
        name: "Collision Org",
        slug: baseSlug,
        ownerEmail: ownerEmail1,
      },
    });
    expect(res1.status()).toBe(201);
    const body1 = await res1.json();
    expect(body1.org.slug).toBe(baseSlug);

    const ownerEmail2 = `e2e-coll2-${Date.now()}@v2-11-e2e.test`;
    const res2 = await page.request.post("/api/platform/organizations", {
      data: {
        name: "Collision Org Bis",
        slug: baseSlug,
        ownerEmail: ownerEmail2,
      },
    });
    expect(res2.status()).toBe(201);
    const body2 = await res2.json();
    // L'API recalcule un slug libre (-2, -3, ...).
    expect(body2.org.slug).toMatch(new RegExp(`^${baseSlug}-\\d+$`));
  });
});
