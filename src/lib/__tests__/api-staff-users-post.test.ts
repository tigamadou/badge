import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { systemRoleId } from "@/lib/permissions/db";
import { makeCustomRole, makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories } from "@/test/factories";
import type { PlatformSystemKey } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { POST } from "@/app/api/platform/users/route";

beforeEach(() => {
  seedFactories(61);
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

const post = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({}) },
  );

let n = 0;
const email = () => `nouveau-${Date.now()}-${n++}@test.local`;
const staffBody = (platformRoleId: string, extra: object = {}) => ({ email: email(), name: "Nouveau", type: "staff", platformRoleId, ...extra });
const clientBody = (extra: object = {}) => ({ email: email(), name: "Client", type: "client", ...extra });
const roleId = (key: Parameters<typeof systemRoleId>[1]) => systemRoleId(prisma, key);

describe("POST /api/platform/users", () => {
  it("401 sans session ; 403 pour STAFF_OBSERVER, STAFF_PRINTER et un non-staff", async () => {
    as(null);
    expect((await post(clientBody())).status).toBe(401);
    for (const role of ["STAFF_OBSERVER", "STAFF_PRINTER"] as const) {
      await actAs(role);
      expect((await post(clientBody())).status).toBe(403);
    }
    as(await makeUser());
    expect((await post(clientBody())).status).toBe(403);
  });

  it("STAFF_SUPPORT crée un client (201) mais pas un staff (403)", async () => {
    await actAs("STAFF_SUPPORT");
    expect((await post(clientBody())).status).toBe(201);
    const res = await post(staffBody(await roleId("STAFF_OBSERVER")));
    expect([res.status, (await res.json()).error]).toEqual([403, "PERMISSION_DENIED"]);
  });

  it("STAFF_ADMIN crée Support, Observateur et Imprimeur ; pas STAFF_ADMIN ni SUPER_ADMIN", async () => {
    await actAs("STAFF_ADMIN");
    for (const key of ["STAFF_SUPPORT", "STAFF_OBSERVER", "STAFF_PRINTER"] as const) {
      const res = await post(staffBody(await roleId(key)));
      expect(res.status).toBe(201);
      const { user } = await res.json();
      expect(user).toMatchObject({ isStaff: true, platformRole: { systemKey: key } });
      const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row).toMatchObject({ isStaff: true, platformRoleId: user.platformRole.id });
    }
    for (const key of ["STAFF_ADMIN", "SUPER_ADMIN"] as const) {
      const res = await post(staffBody(await roleId(key)));
      expect([res.status, (await res.json()).error]).toEqual([403, "PERMISSION_DENIED"]);
    }
  });

  it("SUPER_ADMIN crée un STAFF_ADMIN et un SUPER_ADMIN ; double écriture de l'enum", async () => {
    await actAs("SUPER_ADMIN");
    for (const key of ["STAFF_ADMIN", "SUPER_ADMIN"] as const) {
      const { user } = await (await post(staffBody(await roleId(key)))).json();
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).staffRole).toBe(key);
    }
    const printer = (await (await post(staffBody(await roleId("STAFF_PRINTER")))).json()).user;
    expect((await prisma.user.findUniqueOrThrow({ where: { id: printer.id } })).staffRole).toBeNull();
  });

  it("rôle plateforme personnalisé attribuable seulement si l'acteur détient toutes ses permissions", async () => {
    const custom = await makeCustomRole({ scope: "PLATFORM", permissions: ["users.read", "settings.secrets.update"] });
    await actAs("STAFF_ADMIN");
    const refused = await post(staffBody(custom.id));
    expect([refused.status, (await refused.json()).error]).toEqual([403, "PERMISSION_NOT_HELD"]);
    await actAs("SUPER_ADMIN");
    const ok = await post(staffBody(custom.id));
    expect(ok.status).toBe(201);
    const { user } = await ok.json();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).staffRole).toBeNull();
  });

  it("rôle inconnu 404, archivé 404, de niveau ORG 400", async () => {
    await actAs("SUPER_ADMIN");
    const org = await makeOrg();
    const archived = await makeCustomRole({ scope: "PLATFORM", permissions: [] });
    await prisma.role.update({ where: { id: archived.id }, data: { archived: true } });
    const orgRole = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: [] });
    expect((await post(staffBody("inconnu"))).status).toBe(404);
    expect((await post(staffBody(archived.id))).status).toBe(404);
    expect((await post(staffBody(orgRole.id))).status).toBe(400);
  });

  it("client rattaché à une organisation (orgId + orgRoleId), journal et appartenance avec roleId", async () => {
    const actor = await actAs("STAFF_ADMIN");
    const org = await makeOrg();
    const res = await post(clientBody({ orgId: org.id, orgRoleId: await roleId("MANAGER") }));
    expect(res.status).toBe(201);
    const { user } = await res.json();
    const m = await prisma.orgMembership.findFirstOrThrow({ where: { userId: user.id }, include: { roleRef: true } });
    expect(m).toMatchObject({ orgId: org.id, role: "MANAGER" });
    expect(m.roleRef?.systemKey).toBe("MANAGER");
    const logs = await prisma.activityLog.findMany({ where: { targetId: user.id, userId: actor.id } });
    expect(logs.map((l) => l.type).sort()).toEqual(["MEMBERSHIP_ADDED", "USER_CREATED"]);
    expect(await prisma.notification.count({ where: { userId: user.id, type: "ORG_MEMBERSHIP_ADDED" } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).inviteToken).toBeTruthy();
  });

  it("orgId sans orgRoleId : propriétaire par défaut ; plusieurs orgMemberships dont un rôle sans enum", async () => {
    await actAs("STAFF_ADMIN");
    const [a, b] = [await makeOrg(), await makeOrg()];
    const { user: u1 } = await (await post(clientBody({ orgId: a.id }))).json();
    expect((await prisma.orgMembership.findFirstOrThrow({ where: { userId: u1.id } })).role).toBe("OWNER");
    const custom = await makeCustomRole({ scope: "ORG", orgId: b.id, name: "Comptable", permissions: ["org.read"] });
    const { user: u2 } = await (
      await post(clientBody({ orgMemberships: [{ orgId: a.id, roleId: await roleId("AGENT") }, { orgId: b.id, roleId: custom.id }] }))
    ).json();
    const rows = await prisma.orgMembership.findMany({ where: { userId: u2.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.role)).toEqual([null, null]);
    expect(rows.map((r) => r.roleId).sort()).toEqual([custom.id, await roleId("AGENT")].sort());
    expect(await prisma.notification.count({ where: { userId: u2.id } })).toBe(2);
  });

  it("IDOR : un rôle d'une autre organisation 404, organisation inconnue 404 ; rien n'est créé", async () => {
    await actAs("SUPER_ADMIN");
    const [a, b] = [await makeOrg(), await makeOrg()];
    const foreign = await makeCustomRole({ scope: "ORG", orgId: b.id, permissions: [] });
    const before = await prisma.user.count();
    expect((await post(clientBody({ orgId: a.id, orgRoleId: foreign.id }))).status).toBe(404);
    expect((await post(clientBody({ orgId: "inconnue" }))).status).toBe(404);
    expect(await prisma.user.count()).toBe(before);
  });

  it("anti-escalade : un rôle d'organisation personnalisé non détenu est refusé au staff", async () => {
    await actAs("STAFF_ADMIN");
    const org = await makeOrg();
    const payer = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: ["billing.subscription.pay"] });
    const res = await post(clientBody({ orgId: org.id, orgRoleId: payer.id }));
    expect([res.status, (await res.json()).error]).toEqual([403, "PERMISSION_NOT_HELD"]);
  });

  it("409 sur e-mail déjà pris, 400 sur corps invalide, JSON malformé et staff sans rôle", async () => {
    await actAs("SUPER_ADMIN");
    const taken = await makeOrgMember((await makeOrg()).id, "OWNER");
    expect((await post(clientBody({ email: taken.email.toUpperCase() }))).status).toBe(409);
    expect((await post({ email: "x@y.com" })).status).toBe(400);
    expect((await post("{pas du json")).status).toBe(400);
    expect((await post({ email: email(), name: "S", type: "staff" })).status).toBe(400);
    expect((await post(clientBody({ staffRole: "STAFF_ADMIN" }))).status).toBe(400);
  });

  it("les clients n'ont pas de rôle plateforme même si un platformRoleId est fourni", async () => {
    await actAs("SUPER_ADMIN");
    const { user } = await (await post(clientBody({ platformRoleId: await roleId("SUPER_ADMIN") }))).json();
    expect(user).toMatchObject({ isStaff: false, platformRole: null });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).platformRoleId).toBeNull();
  });
});
