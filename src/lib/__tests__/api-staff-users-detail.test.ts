import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { systemRoleId } from "@/lib/permissions/db";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission } from "@/lib/permissions";
import { makeCustomRole, makeEvent, makeEventMember, makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories } from "@/test/factories";
import type { PlatformSystemKey } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { DELETE, GET, PATCH } from "@/app/api/platform/users/[userId]/route";
import { POST as RESET } from "@/app/api/platform/users/[userId]/reset-password/route";

beforeEach(() => {
  seedFactories(62);
  vi.mocked(getServerSession).mockReset();
});

function as(user: { id: string; email: string; name: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null);
}
async function actAs(role: PlatformSystemKey) {
  const user = await makeStaff(role);
  as(user);
  return user;
}
const ctx = (userId: string) => ({ params: Promise.resolve({ userId }) });
const req = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/platform/users/x", {
    method,
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });
const patch = (userId: string, body: unknown) => PATCH(req("PATCH", body), ctx(userId));
const roleId = (key: Parameters<typeof systemRoleId>[1]) => systemRoleId(prisma, key);
const err = async (r: Promise<Response>) => { const res = await r; return [res.status, (await res.json()).error]; };

describe("GET /api/platform/users/[userId]", () => {
  it("401 sans session, 403 pour un non-staff, 404 pour un compte inconnu", async () => {
    as(null);
    expect((await GET(req("GET"), ctx("x"))).status).toBe(401);
    as(await makeUser());
    expect((await GET(req("GET"), ctx("x"))).status).toBe(403);
    await actAs("STAFF_OBSERVER");
    expect((await GET(req("GET"), ctx("inconnu"))).status).toBe(404);
  });

  it("STAFF_OBSERVER lit la fiche : rôles de plateforme, d'organisation et d'évènement, sans mot de passe", async () => {
    await actAs("STAFF_OBSERVER");
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const target = await makeStaff("STAFF_SUPPORT");
    await prisma.orgMembership.create({ data: { userId: target.id, orgId: org.id, roleId: await roleId("AGENT") } });
    await prisma.eventMembership.create({ data: { userId: target.id, eventId: event.id, roleId: await roleId("VIEWER") } });
    const { user } = await (await GET(req("GET"), ctx(target.id))).json();
    expect(user.password).toBeUndefined();
    expect(user.platformRole).toMatchObject({ systemKey: "STAFF_SUPPORT", name: "Support" });
    expect(user.orgMemberships[0].roleRef).toMatchObject({ systemKey: "AGENT" });
    expect(user.eventMemberships[0].roleRef).toMatchObject({ systemKey: "VIEWER" });
  });
});

describe("PATCH /api/platform/users/[userId]", () => {
  it("401 sans session ; 403 pour un participant et pour STAFF_OBSERVER (plus de users.update)", async () => {
    const target = await makeUser();
    as(null);
    expect((await patch(target.id, { name: "N" })).status).toBe(401);
    as(await makeUser());
    expect((await patch(target.id, { name: "N" })).status).toBe(403);
    await actAs("STAFF_OBSERVER");
    expect((await patch(target.id, { name: "N" })).status).toBe(403);
  });

  it("STAFF_SUPPORT ne modifie plus rien (403) ; STAFF_ADMIN renomme", async () => {
    await actAs("STAFF_SUPPORT");
    const target = await makeUser();
    expect(await err(patch(target.id, { name: "Nouveau nom" }))).toEqual([403, "PERMISSION_DENIED"]);
    await actAs("STAFF_ADMIN");
    expect((await patch(target.id, { name: "Nouveau nom" })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).name).toBe("Nouveau nom");
  });

  it("chaque champ exige sa permission : rôle seul (assign_role) ne permet ni renommer ni archiver", async () => {
    const roleOnly = await makeCustomRole({ scope: "PLATFORM", permissions: ["platform.access", "users.staff.assign_role"] });
    as(await makeUser({ isStaff: true, platformRoleId: roleOnly.id }));
    const target = await makeUser();
    expect(await err(patch(target.id, { name: "N" }))).toEqual([403, "PERMISSION_DENIED"]);
    expect(await err(patch(target.id, { archived: true }))).toEqual([403, "PERMISSION_DENIED"]);
    expect((await patch(target.id, { platformRoleId: null })).status).toBe(200);
  });

  it("STAFF_ADMIN : change le rôle d'un staff vers Imprimeur, journalise, double écriture ; pas son propre rôle", async () => {
    const admin = await actAs("STAFF_ADMIN");
    const target = await makeStaff("STAFF_OBSERVER");
    const res = await patch(target.id, { platformRoleId: await roleId("STAFF_PRINTER") });
    expect(res.status).toBe(200);
    expect((await res.json()).user.platformRole).toMatchObject({ systemKey: "STAFF_PRINTER" });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(row).toMatchObject({ isStaff: true, staffRole: null });
    expect(await prisma.activityLog.count({ where: { type: "USER_UPDATED", targetId: target.id, userId: admin.id } })).toBe(1);
    expect(await err(patch(admin.id, { platformRoleId: await roleId("STAFF_SUPPORT") }))).toEqual([403, "SELF_MODIFICATION"]);
    expect(await err(patch(admin.id, { archived: true }))).toEqual([403, "SELF_MODIFICATION"]);
    expect((await patch(admin.id, { name: "Moi" })).status).toBe(200);
  });

  it("promotion vers STAFF_ADMIN / SUPER_ADMIN et rétrogradation d'un STAFF_ADMIN exigent assign_top_role", async () => {
    await actAs("STAFF_ADMIN");
    const support = await makeStaff("STAFF_SUPPORT");
    const other = await makeStaff("STAFF_ADMIN");
    expect(await err(patch(support.id, { platformRoleId: await roleId("STAFF_ADMIN") }))).toEqual([403, "PERMISSION_DENIED"]);
    expect(await err(patch(support.id, { platformRoleId: await roleId("SUPER_ADMIN") }))).toEqual([403, "PERMISSION_DENIED"]);
    expect(await err(patch(other.id, { platformRoleId: await roleId("STAFF_SUPPORT") }))).toEqual([403, "PERMISSION_DENIED"]);
    expect(await err(patch(other.id, { platformRoleId: null }))).toEqual([403, "PERMISSION_DENIED"]);
    await actAs("SUPER_ADMIN");
    expect((await patch(support.id, { platformRoleId: await roleId("STAFF_ADMIN") })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: support.id } })).staffRole).toBe("STAFF_ADMIN");
  });

  it("rôle plateforme personnalisé : anti-escalade ; rôle d'organisation 400 ; archivé ou inconnu 404", async () => {
    const org = await makeOrg();
    const custom = await makeCustomRole({ scope: "PLATFORM", permissions: ["settings.secrets.update"] });
    const orgRole = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: [] });
    const archived = await makeCustomRole({ scope: "PLATFORM", permissions: [] });
    await prisma.role.update({ where: { id: archived.id }, data: { archived: true } });
    const target = await makeStaff("STAFF_OBSERVER");
    await actAs("STAFF_ADMIN");
    expect(await err(patch(target.id, { platformRoleId: custom.id }))).toEqual([403, "PERMISSION_NOT_HELD"]);
    await actAs("SUPER_ADMIN");
    expect((await patch(target.id, { platformRoleId: custom.id })).status).toBe(200);
    expect(await err(patch(target.id, { platformRoleId: orgRole.id }))).toEqual([400, "INVALID_ROLE"]);
    expect(await err(patch(target.id, { platformRoleId: archived.id }))).toEqual([404, "NOT_FOUND"]);
    expect(await err(patch(target.id, { platformRoleId: "inconnu" }))).toEqual([404, "NOT_FOUND"]);
  });

  it("retirer le rôle repasse isStaff à false et le contexte perd ses droits plateforme", async () => {
    await actAs("SUPER_ADMIN");
    const target = await makeStaff("STAFF_OBSERVER");
    expect(hasPermission((await loadUserContext(target.id))!, "users.read", { kind: "platform" })).toBe(true);
    expect((await patch(target.id, { platformRoleId: null })).status).toBe(200);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(row).toMatchObject({ isStaff: false, platformRoleId: null, staffRole: null });
    expect(hasPermission((await loadUserContext(target.id))!, "users.read", { kind: "platform" })).toBe(false);
  });

  it("promouvoir un compte client en staff", async () => {
    await actAs("SUPER_ADMIN");
    const target = await makeUser();
    expect((await patch(target.id, { platformRoleId: await roleId("STAFF_SUPPORT") })).status).toBe(200);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({ isStaff: true, staffRole: "STAFF_SUPPORT" });
  });

  it("dernier SUPER_ADMIN : ni retiré ni archivé (409) ; avec un autre SUPER_ADMIN actif c'est permis", async () => {
    // acteur non SUPER_ADMIN mais porteur des permissions de gestion des rôles supérieurs
    const gate = await makeCustomRole({
      scope: "PLATFORM",
      permissions: ["platform.access", "users.staff.assign_role", "users.staff.assign_top_role", "users.archive"],
    });
    as(await makeUser({ isStaff: true, platformRoleId: gate.id }));
    const target = await makeStaff("SUPER_ADMIN");
    expect(await err(patch(target.id, { platformRoleId: null }))).toEqual([409, "LAST_SUPER_ADMIN"]);
    expect(await err(patch(target.id, { archived: true }))).toEqual([409, "LAST_SUPER_ADMIN"]);
    expect(await err(DELETE(req("DELETE"), ctx(target.id)))).toEqual([409, "LAST_SUPER_ADMIN"]);
    await makeStaff("SUPER_ADMIN");
    expect((await patch(target.id, { platformRoleId: null })).status).toBe(200);
  });

  it("archive et désarchive : archivedAt posé puis effacé", async () => {
    await actAs("STAFF_ADMIN");
    const target = await makeUser();
    const archived = await patch(target.id, { archived: true });
    expect((await archived.json()).user.archivedAt).not.toBeNull();
    const restored = await patch(target.id, { archived: false });
    expect((await restored.json()).user.archivedAt).toBeNull();
  });

  it("400 : JSON malformé, corps vide, champ inconnu (dont l'ancien staffRole) ; 404 : compte inconnu", async () => {
    await actAs("SUPER_ADMIN");
    const target = await makeUser();
    expect((await PATCH(req("PATCH", "{pas du json"), ctx(target.id))).status).toBe(400);
    expect(await err(patch(target.id, {}))).toEqual([400, "NOTHING_TO_UPDATE"]);
    expect((await patch(target.id, { staffRole: "STAFF_ADMIN" })).status).toBe(400);
    expect((await patch("inconnu", { name: "N" })).status).toBe(404);
  });
});

describe("POST /api/platform/users/[userId]/reset-password", () => {
  it("401 sans session ; 403 pour STAFF_OBSERVER et STAFF_PRINTER", async () => {
    const target = await makeUser();
    as(null);
    expect((await RESET(req("POST"), ctx(target.id))).status).toBe(401);
    for (const role of ["STAFF_OBSERVER", "STAFF_PRINTER"] as const) {
      await actAs(role);
      expect((await RESET(req("POST"), ctx(target.id))).status).toBe(403);
    }
  });

  it("STAFF_SUPPORT régénère le jeton et journalise ; 404 inconnu ; 400 archivé", async () => {
    const actor = await actAs("STAFF_SUPPORT");
    const target = await makeUser();
    expect((await RESET(req("POST"), ctx(target.id))).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).inviteToken).toBeTruthy();
    expect(await prisma.activityLog.count({ where: { type: "USER_PASSWORD_SET", targetId: target.id, userId: actor.id } })).toBe(1);
    expect((await RESET(req("POST"), ctx("inconnu"))).status).toBe(404);
    const archived = await makeUser({ archived: true });
    expect((await RESET(req("POST"), ctx(archived.id))).status).toBe(400);
  });
});

describe("DELETE /api/platform/users/[userId]", () => {
  it("401 sans session ; 403 pour STAFF_SUPPORT", async () => {
    const target = await makeUser();
    as(null);
    expect((await DELETE(req("DELETE"), ctx(target.id))).status).toBe(401);
    await actAs("STAFF_SUPPORT");
    expect((await DELETE(req("DELETE"), ctx(target.id))).status).toBe(403);
  });

  it("STAFF_ADMIN archive (204) et journalise ; pas soi-même ; 404 inconnu", async () => {
    const admin = await actAs("STAFF_ADMIN");
    const target = await makeOrgMember((await makeOrg()).id, "MANAGER");
    expect((await DELETE(req("DELETE"), ctx(target.id))).status).toBe(204);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).archived).toBe(true);
    expect(await prisma.activityLog.count({ where: { type: "USER_DELETED", targetId: target.id } })).toBe(1);
    expect(await err(DELETE(req("DELETE"), ctx(admin.id)))).toEqual([403, "SELF_MODIFICATION"]);
    expect((await DELETE(req("DELETE"), ctx("inconnu"))).status).toBe(404);
  });

  it("un SUPER_ADMIN avec un autre actif est archivé (204)", async () => {
    await actAs("SUPER_ADMIN");
    const target = await makeStaff("SUPER_ADMIN");
    expect((await DELETE(req("DELETE"), ctx(target.id))).status).toBe(204);
  });

  it("un membre d'évènement est archivé comme un autre compte", async () => {
    await actAs("STAFF_ADMIN");
    const event = await makeEvent((await makeOrg()).id);
    const member = await makeEventMember(event.id, "VIEWER");
    expect((await DELETE(req("DELETE"), ctx(member.id))).status).toBe(204);
  });
});
