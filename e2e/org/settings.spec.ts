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

test.describe("T18 Org settings", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("OWNER modifie infos org via PATCH", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "settings-info" });
    await loginAs(page, owner);

    const payload = {
      name: "E2E Org Updated",
      legalName: "Société E2E SARL",
      contactEmail: "contact@e2e.test",
      contactPhone: "+225 00 00 00 00",
      addressLine1: "Rue de la République",
      city: "Abidjan",
      country: "Côte d'Ivoire",
    };
    const res = await request.patch(`/api/org/${orgId}`, { data: payload });
    expect(res.status()).toBe(200);

    const db = getDb();
    const updated = await db.organization.findUnique({ where: { id: orgId } });
    expect(updated?.name).toBe(payload.name);
    expect(updated?.legalName).toBe(payload.legalName);
    expect(updated?.contactEmail).toBe(payload.contactEmail);
    expect(updated?.city).toBe(payload.city);

    const log = await expectLastActivity({
      type: "ORG_UPDATED",
      orgId,
      userId: owner.id,
    });
    const details = log.details as { changedFields?: string[] } | null;
    expect(Array.isArray(details?.changedFields)).toBe(true);
    expect(details?.changedFields).toEqual(
      expect.arrayContaining(["name", "legalName", "contactEmail", "city"]),
    );
  });

  test("OWNER selectionne badge template org (default-v1)", async ({
    page,
    request,
  }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "settings-badge" });
    await loginAs(page, owner);

    const res = await request.patch(`/api/org/${orgId}/settings/badge`, {
      data: { badgeTemplateId: "default-v1" },
    });
    expect(res.status()).toBe(200);

    const db = getDb();
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { badgeTemplateId: true },
    });
    expect(org?.badgeTemplateId).toBe("default-v1");

    const log = await expectLastActivity({
      type: "ORG_UPDATED",
      orgId,
      userId: owner.id,
    });
    const details = log.details as { field?: string; value?: string } | null;
    expect(details?.field).toBe("badgeTemplateId");
    expect(details?.value).toBe("default-v1");
  });

  test("OWNER reset badge template org (null)", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "settings-badge-null" });
    await loginAs(page, owner);

    // Pose d'abord un template, puis reset.
    await request.patch(`/api/org/${orgId}/settings/badge`, {
      data: { badgeTemplateId: "default-v1" },
    });
    const res = await request.patch(`/api/org/${orgId}/settings/badge`, {
      data: { badgeTemplateId: null },
    });
    expect(res.status()).toBe(200);

    const db = getDb();
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { badgeTemplateId: true },
    });
    expect(org?.badgeTemplateId).toBeNull();
  });

  test("Payload SMTP rejete sur PATCH /api/org/[orgId] -> 400", async ({
    page,
    request,
  }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "settings-smtp" });
    await loginAs(page, owner);

    const res = await request.patch(`/api/org/${orgId}`, {
      data: { smtpHost: "smtp.example.com" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION");
  });

  test("MANAGER ne peut pas editer infos org -> 403", async ({ page, request }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "settings-mgr-403" });
    const manager = await createTestOrgMember({
      scope: "settings-mgr",
      orgId,
      role: "MANAGER",
    });
    await loginAs(page, manager);

    const res = await request.patch(`/api/org/${orgId}`, {
      data: { name: "Tentative MANAGER" },
    });
    expect(res.status()).toBe(403);
  });
});
