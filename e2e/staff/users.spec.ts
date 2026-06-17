import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestOrgWithOwner,
  createTestStaff,
  createTestUser,
  disconnectDb,
  getDb,
} from "../helpers/db";
import { loginAsStaff } from "../helpers/auth";
import { mailpit } from "../helpers/mailpit";
import { expectLastActivity } from "../helpers/audit";

test.describe("Staff > users CRUD", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("STAFF_ADMIN cree un user client + OrgMembership MANAGER", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "users-client" });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "users-client-admin" });
    await mailpit.clear();

    const email = `e2e-client-${Date.now()}@v2-11-e2e.test`;
    const res = await page.request.post("/api/staff/users", {
      data: {
        email,
        name: "Client E2E",
        type: "client",
        orgId,
        orgRole: "MANAGER",
      },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    const newUserId = json.user.id;

    const dbUser = await getDb().user.findUnique({
      where: { id: newUserId },
      select: { isStaff: true, staffRole: true },
    });
    expect(dbUser?.isStaff).toBe(false);
    expect(dbUser?.staffRole).toBeNull();

    const ms = await getDb().orgMembership.findFirst({
      where: { userId: newUserId, orgId },
      select: { role: true },
    });
    expect(ms?.role).toBe("MANAGER");

    await mailpit.expectMail({
      to: email,
      subjectPattern: /bienvenue|invitation/i,
      timeoutMs: 8000,
    });

    await expectLastActivity({ type: "USER_CREATED", targetId: newUserId });
  });

  test("STAFF_ADMIN cree un user staff STAFF_SUPPORT", async ({ page }) => {
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "users-staff" });
    await mailpit.clear();

    const email = `e2e-staff-${Date.now()}@v2-11-e2e.test`;
    const res = await page.request.post("/api/staff/users", {
      data: {
        email,
        name: "Staff E2E",
        type: "staff",
        staffRole: "STAFF_SUPPORT",
      },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    const dbUser = await getDb().user.findUnique({
      where: { id: json.user.id },
      select: { isStaff: true, staffRole: true },
    });
    expect(dbUser?.isStaff).toBe(true);
    expect(dbUser?.staffRole).toBe("STAFF_SUPPORT");

    await mailpit.expectMail({
      to: email,
      subjectPattern: /bienvenue|invitation/i,
      timeoutMs: 8000,
    });
  });

  test("STAFF_SUPPORT reset password d'un client (regenere inviteToken + mail)", async ({ page }) => {
    const target = await createTestUser({ scope: "users-reset-target", verified: true });
    await loginAsStaff(page, { role: "STAFF_SUPPORT", scope: "users-reset" });
    await mailpit.clear();

    const before = await getDb().user.findUnique({
      where: { id: target.id },
      select: { inviteToken: true },
    });

    const res = await page.request.post(
      `/api/staff/users/${target.id}/reset-password`,
    );
    expect(res.status()).toBe(200);

    const after = await getDb().user.findUnique({
      where: { id: target.id },
      select: { inviteToken: true, inviteTokenExpiry: true },
    });
    expect(after?.inviteToken).not.toBeNull();
    expect(after?.inviteToken).not.toBe(before?.inviteToken);
    expect(after?.inviteTokenExpiry).not.toBeNull();

    await mailpit.expectMail({
      to: target.email,
      subjectPattern: /reinitialisation|réinitialisation|mot de passe/i,
      timeoutMs: 8000,
    });

    await expectLastActivity({ type: "USER_PASSWORD_SET", targetId: target.id });
  });

  test("STAFF_ADMIN archive un user (soft delete)", async ({ page }) => {
    const target = await createTestUser({ scope: "users-archive-target", verified: true });
    await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "users-archive" });

    const res = await page.request.delete(`/api/staff/users/${target.id}`);
    expect(res.status()).toBe(204);

    const after = await getDb().user.findUnique({
      where: { id: target.id },
      select: { archived: true, archivedAt: true },
    });
    expect(after?.archived).toBe(true);
    expect(after?.archivedAt).not.toBeNull();

    await expectLastActivity({ type: "USER_DELETED", targetId: target.id });
  });

  test("Cannot archive last SUPER_ADMIN (garde-fou)", async ({ page }) => {
    // L'operateur est un STAFF_ADMIN (peut DELETE), ainsi il n'apparait pas dans
    // le compteur des SUPER_ADMIN actifs et ne reduit pas notre invariant.
    // La cible `lone` est cree SUPER_ADMIN ; on archive tous les autres
    // SUPER_ADMIN actifs (y compris le seed) pour qu'elle soit l'unique restant.
    const lone = await createTestStaff({ role: "SUPER_ADMIN", scope: "lone-super" });

    // Snapshot des SUPER_ADMIN actifs (hors lone) pour les restaurer apres.
    const others = await getDb().user.findMany({
      where: { staffRole: "SUPER_ADMIN", archived: false, id: { not: lone.id } },
      select: { id: true },
    });
    const otherIds = others.map((u) => u.id);
    if (otherIds.length > 0) {
      await getDb().user.updateMany({
        where: { id: { in: otherIds } },
        data: { archived: true, archivedAt: new Date() },
      });
    }

    try {
      // Verifie l'invariant attendu : un seul SUPER_ADMIN actif (= lone).
      const remaining = await getDb().user.count({
        where: { staffRole: "SUPER_ADMIN", archived: false },
      });
      expect(remaining).toBe(1);

      await loginAsStaff(page, { role: "STAFF_ADMIN", scope: "lone-super-actor" });

      const res = await page.request.delete(`/api/staff/users/${lone.id}`);
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("LAST_SUPER_ADMIN");
    } finally {
      // Restaure les SUPER_ADMIN initialement actifs (notamment le seed) pour
      // ne pas casser les tests suivants ou les sessions futures.
      if (otherIds.length > 0) {
        await getDb().user.updateMany({
          where: { id: { in: otherIds } },
          data: { archived: false, archivedAt: null },
        });
      }
    }
  });

  test("SUPER_ADMIN promeut STAFF_SUPPORT -> STAFF_ADMIN", async ({ page }) => {
    const target = await createTestStaff({ role: "STAFF_SUPPORT", scope: "users-promote-target" });
    await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "users-promote" });

    const res = await page.request.patch(`/api/staff/users/${target.id}`, {
      data: { staffRole: "STAFF_ADMIN" },
    });
    expect(res.status()).toBe(200);

    const dbUser = await getDb().user.findUnique({
      where: { id: target.id },
      select: { isStaff: true, staffRole: true },
    });
    expect(dbUser?.isStaff).toBe(true);
    expect(dbUser?.staffRole).toBe("STAFF_ADMIN");

    await expectLastActivity({ type: "USER_UPDATED", targetId: target.id });
  });

  test("Cannot change self role (PATCH son propre staffRole -> 403)", async ({ page }) => {
    const me = await loginAsStaff(page, { role: "SUPER_ADMIN", scope: "users-self" });

    const res = await page.request.patch(`/api/staff/users/${me.id}`, {
      data: { staffRole: "STAFF_OBSERVER" },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("CANNOT_CHANGE_SELF");
  });
});
