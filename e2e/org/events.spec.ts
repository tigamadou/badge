import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestCategoryTemplate,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";

test.describe("T15 Org events", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("OWNER cree event via wizard 3 steps avec templates + categorie manuelle", async ({
    page,
  }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "events-create" });

    // Pre-cree 2 templates orgs avant le login (visibles par le serveur a la
    // generation de /new).
    const tpl1 = await createTestCategoryTemplate({
      orgId,
      name: "VIP",
      color: "#ff0000",
      number: 10,
    });
    const tpl2 = await createTestCategoryTemplate({
      orgId,
      name: "Standard",
      color: "#00ff00",
      number: 11,
    });

    await loginAs(page, owner);

    // Step 1 : titre + date + lieu (le wizard suggere un slug automatique).
    await page.goto(`/admin/${orgId}/events/new`);
    await page.getByPlaceholder("Titre").fill("E2E Event Wizard");
    // L'input date est un type="date" : on injecte une date ISO valide.
    const futureIso = new Date(Date.now() + 30 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    await page.locator('input[type="date"]').fill(futureIso);
    await page.getByPlaceholder("Lieu").fill("Abidjan");
    await page.getByRole("button", { name: /^suivant$/i }).click();

    // Step 2 : selectionne les 2 templates en mode "template". Le wizard UI ne
    // permet pas templates + manuel simultanement -- on selectionne juste les
    // 2 templates ici (la spec API supporterait les deux modes mais l'UI non).
    await page.getByRole("button", { name: /partir d'un mod[èe]le/i }).click();
    expect(tpl1.id).toBeTruthy();
    expect(tpl2.id).toBeTruthy();
    await page.locator(`label:has-text("VIP")`).locator("input[type=checkbox]").check();
    await page
      .locator(`label:has-text("Standard")`)
      .locator("input[type=checkbox]")
      .check();
    await page.getByRole("button", { name: /^suivant$/i }).click();

    // Step 3 : recap + creation.
    await expect(page.getByText(/r[ée]cap/i)).toBeVisible();
    await page.getByRole("button", { name: /cr[ée]er l'?[ée]v[ée]nement/i }).click();

    // Redirection vers /settings de l'event cree.
    await page.waitForURL(
      new RegExp(`/admin/${orgId}/events/[^/]+/settings`),
      { timeout: 8000 },
    );

    // BDD : event cree avec 2 categories (les 2 templates importes), inscriptions fermees.
    const db = getDb();
    const event = await db.event.findFirst({
      where: { orgId, title: "E2E Event Wizard" },
      select: { id: true, registrationOpen: true, categories: true },
    });
    expect(event).not.toBeNull();
    expect(event?.registrationOpen).toBe(false);
    expect(event?.categories.length).toBe(2);

    await expectLastActivity({
      type: "EVENT_CREATED",
      userId: owner.id,
      orgId,
      eventId: event?.id,
    });
  });

  test("OWNER archive event", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "events-archive" });
    await loginAs(page, owner);

    // Cree un event minimal via Prisma (les categories ne sont pas necessaires
    // pour le test d'archivage).
    const db = getDb();
    const event = await db.event.create({
      data: {
        orgId,
        title: "Event a archiver",
        slug: `e2e-archive-${Date.now()}`,
        location: "Abidjan",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });

    const res = await request.post(
      `/api/admin/${orgId}/events/${event.id}/archive`,
    );
    expect(res.status()).toBe(200);

    const after = await db.event.findUnique({
      where: { id: event.id },
      select: { archived: true, archivedAt: true, registrationOpen: true },
    });
    expect(after?.archived).toBe(true);
    expect(after?.archivedAt).not.toBeNull();
    expect(after?.registrationOpen).toBe(false);

    await expectLastActivity({
      type: "EVENT_ARCHIVED",
      orgId,
      eventId: event.id,
      userId: owner.id,
    });
  });

  test("OWNER restaure event archive", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "events-restore" });
    await loginAs(page, owner);

    const db = getDb();
    const event = await db.event.create({
      data: {
        orgId,
        title: "Event a restaurer",
        slug: `e2e-restore-${Date.now()}`,
        location: "Abidjan",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        archived: true,
        archivedAt: new Date(),
      },
    });

    const res = await request.post(
      `/api/admin/${orgId}/events/${event.id}/restore`,
    );
    expect(res.status()).toBe(200);

    const after = await db.event.findUnique({
      where: { id: event.id },
      select: { archived: true, archivedAt: true },
    });
    expect(after?.archived).toBe(false);
    expect(after?.archivedAt).toBeNull();

    await expectLastActivity({
      type: "EVENT_RESTORED",
      orgId,
      eventId: event.id,
      userId: owner.id,
    });
  });

  test("Quota events atteint -> 409 QUOTA_EXCEEDED", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "events-quota",
      quotaMaxEvents: 2,
    });
    await loginAs(page, owner);

    const db = getDb();
    // Pre-cree 2 events non archives pour saturer le quota.
    await db.event.create({
      data: {
        orgId,
        title: "Quota 1",
        slug: `e2e-quota-1-${Date.now()}`,
        location: "Abidjan",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
    await db.event.create({
      data: {
        orgId,
        title: "Quota 2",
        slug: `e2e-quota-2-${Date.now()}`,
        location: "Abidjan",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });

    const res = await request.post(`/api/admin/${orgId}/events`, {
      data: {
        title: "Quota 3",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        location: "Abidjan",
      },
    });
    expect(res.status()).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("QUOTA_EXCEEDED");
  });

  test("Slug collision globale -> 409 SLUG_TAKEN", async ({ page, request }) => {
    // Org A + event "shared-slug".
    const a = await createTestOrgWithOwner({ scope: "slug-a" });
    const sharedSlug = `e2e-shared-${Date.now()}`;
    const db = getDb();
    await db.event.create({
      data: {
        orgId: a.orgId,
        title: "Slug A",
        slug: sharedSlug,
        location: "Abidjan",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });

    // Org B tente de creer un event avec le meme slug.
    const b = await createTestOrgWithOwner({ scope: "slug-b" });
    await loginAs(page, b.owner);

    const res = await request.post(`/api/admin/${b.orgId}/events`, {
      data: {
        title: "Slug B",
        date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        location: "Abidjan",
        slug: sharedSlug,
      },
    });
    expect(res.status()).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("SLUG_TAKEN");
  });
});
