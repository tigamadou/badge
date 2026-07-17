import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity, expectNoActivity } from "../helpers/audit";

test.describe("T16 Org members", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("OWNER invite nouvel user comme MANAGER", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "members-new" });
    await loginAs(page, owner);

    await mailpit.clear();

    const inviteeEmail = `e2e-invitee-new-${Date.now()}@v2-11-e2e.test`;
    const res = await request.post(`/api/org/${orgId}/members`, {
      data: { email: inviteeEmail, name: "Invitee Manager", role: "MANAGER" },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.userId).toBeTruthy();

    const db = getDb();
    const createdUser = await db.user.findUnique({
      where: { email: inviteeEmail },
      select: { id: true, inviteToken: true },
    });
    expect(createdUser).not.toBeNull();
    expect(createdUser?.inviteToken).toBeTruthy();

    const membership = await db.orgMembership.findUnique({
      where: { userId_orgId: { userId: createdUser!.id, orgId } },
    });
    expect(membership?.role).toBe("MANAGER");

    // Audit : USER_CREATED + MEMBERSHIP_ADDED.
    await expectLastActivity({
      type: "USER_CREATED",
      orgId,
      targetId: createdUser!.id,
      userId: owner.id,
    });
    await expectLastActivity({
      type: "MEMBERSHIP_ADDED",
      orgId,
      targetId: createdUser!.id,
      userId: owner.id,
    });

    await mailpit.expectMail({
      to: inviteeEmail,
      subjectPattern: /(invitation|bienvenue)/i,
    });
  });

  test("OWNER invite user existant comme AUDITOR (pas de USER_CREATED)", async ({
    page,
    request,
  }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "members-existing" });
    const existing = await createTestUser({ scope: "existing-aud", verified: true });

    await loginAs(page, owner);

    const res = await request.post(`/api/org/${orgId}/members`, {
      data: { email: existing.email, name: existing.name, role: "AUDITOR" },
    });
    // Le route renvoie 201 pour nouveau + 200 pour deja-existant alreadyMember,
    // mais pour un user existant SANS membership c'est aussi 201.
    expect([200, 201]).toContain(res.status());

    const db = getDb();
    const membership = await db.orgMembership.findUnique({
      where: { userId_orgId: { userId: existing.id, orgId } },
    });
    expect(membership?.role).toBe("AUDITOR");

    // Audit : pas de USER_CREATED pour ce user (il existait deja).
    await expectNoActivity({
      type: "USER_CREATED",
      orgId,
      targetId: existing.id,
    });
    // Mais MEMBERSHIP_ADDED doit etre present.
    await expectLastActivity({
      type: "MEMBERSHIP_ADDED",
      orgId,
      targetId: existing.id,
      userId: owner.id,
    });
  });

  test("OWNER change role MANAGER -> AUDITOR via PATCH", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "members-role-change" });
    await loginAs(page, owner);

    // Cree un MANAGER existant.
    const db = getDb();
    const manager = await createTestUser({ scope: "to-demote", verified: true });
    await db.orgMembership.create({
      data: { userId: manager.id, orgId, role: "MANAGER" },
    });

    const res = await request.patch(
      `/api/org/${orgId}/members/${manager.id}`,
      { data: { role: "AUDITOR" } },
    );
    expect(res.status()).toBe(200);

    const updated = await db.orgMembership.findUnique({
      where: { userId_orgId: { userId: manager.id, orgId } },
    });
    expect(updated?.role).toBe("AUDITOR");

    const log = await expectLastActivity({
      type: "MEMBERSHIP_ROLE_CHANGED",
      orgId,
      targetId: manager.id,
      userId: owner.id,
    });
    const details = log.details as { from?: string; to?: string } | null;
    expect(details?.from).toBe("MANAGER");
    expect(details?.to).toBe("AUDITOR");
  });

  test("Cannot remove last OWNER -> 409 LAST_OWNER", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "members-last-rm" });
    await loginAs(page, owner);

    const res = await request.delete(
      `/api/org/${orgId}/members/${owner.id}`,
    );
    expect(res.status()).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("LAST_OWNER");

    // L'OWNER doit toujours exister.
    const db = getDb();
    const still = await db.orgMembership.findUnique({
      where: { userId_orgId: { userId: owner.id, orgId } },
    });
    expect(still?.role).toBe("OWNER");
  });

  test("Cannot demote last OWNER -> 409 LAST_OWNER", async ({ page, request }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "members-last-demote" });
    await loginAs(page, owner);

    const res = await request.patch(
      `/api/org/${orgId}/members/${owner.id}`,
      { data: { role: "MANAGER" } },
    );
    expect(res.status()).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("LAST_OWNER");

    const db = getDb();
    const still = await db.orgMembership.findUnique({
      where: { userId_orgId: { userId: owner.id, orgId } },
    });
    expect(still?.role).toBe("OWNER");
  });
});
