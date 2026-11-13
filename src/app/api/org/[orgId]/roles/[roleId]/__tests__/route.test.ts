import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { listRoles } from "@/lib/role-management";
import { makeCustomRole, makeOrg, makeOrgMember, makeStaff, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { DELETE, GET, PATCH } from "../route";
import { POST as RESTORE } from "../restore/route";

beforeEach(() => {
  seedFactories(32);
  vi.mocked(getServerSession).mockReset();
});

function as(user: { id: string; email: string; name: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null);
}
const ctx = (orgId: string, roleId: string) => ({ params: Promise.resolve({ orgId, roleId }) });
const req = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/org/o/roles/r", {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });

describe("/api/org/[orgId]/roles/[roleId]", () => {
  it("401 sans session ; 403 pour un MANAGER sur chaque méthode", async () => {
    const org = await makeOrg();
    const role = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: [] });
    as(null);
    expect((await GET(req("GET"), ctx(org.id, role.id))).status).toBe(401);
    as(await makeOrgMember(org.id, "MANAGER"));
    expect((await GET(req("GET"), ctx(org.id, role.id))).status).toBe(403);
    expect((await PATCH(req("PATCH", { name: "Autre" }), ctx(org.id, role.id))).status).toBe(403);
    expect((await DELETE(req("DELETE"), ctx(org.id, role.id))).status).toBe(403);
    expect((await RESTORE(req("POST"), ctx(org.id, role.id))).status).toBe(403);
  });

  it("l'OWNER lit, modifie, archive et restaure un rôle de son organisation", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    const role = await makeCustomRole({ scope: "ORG", orgId: org.id, name: "Initial", permissions: ["org.read"] });
    expect((await (await GET(req("GET"), ctx(org.id, role.id))).json()).role).toMatchObject({ name: "Initial", assignedCount: 0 });
    const patched = await (await PATCH(req("PATCH", { name: "Modifié", permissions: ["org.read", "event.update"] }), ctx(org.id, role.id))).json();
    expect(patched.role).toMatchObject({ name: "Modifié", permissions: ["org.read", "event.update"] });
    expect((await (await DELETE(req("DELETE"), ctx(org.id, role.id))).json()).role.archived).toBe(true);
    expect((await (await RESTORE(req("POST"), ctx(org.id, role.id))).json()).role.archived).toBe(false);
    expect(await prisma.activityLog.count({ where: { orgId: org.id, type: { in: ["ROLE_UPDATED", "ROLE_ARCHIVED", "ROLE_RESTORED"] } } })).toBe(3);
  });

  it("IDOR : un rôle d'une autre organisation, un rôle plateforme ou inconnu répond 404 partout", async () => {
    const [a, b] = [await makeOrg(), await makeOrg()];
    as(await makeOrgMember(a.id, "OWNER"));
    const foreign = await makeCustomRole({ scope: "ORG", orgId: b.id, permissions: ["org.read"] });
    const platformCustom = await makeCustomRole({ scope: "PLATFORM", permissions: ["users.read"] });
    const platformSystem = (await listRoles({ scope: "PLATFORM" }))[0];
    for (const id of [foreign.id, platformCustom.id, platformSystem.id, "inconnu"]) {
      expect((await GET(req("GET"), ctx(a.id, id))).status).toBe(404);
      expect((await PATCH(req("PATCH", { name: "Piraté" }), ctx(a.id, id))).status).toBe(404);
      expect((await DELETE(req("DELETE"), ctx(a.id, id))).status).toBe(404);
      expect((await RESTORE(req("POST"), ctx(a.id, id))).status).toBe(404);
    }
    expect((await prisma.role.findUniqueOrThrow({ where: { id: foreign.id } })).archived).toBe(false);
  });

  it("rôle système d'organisation : 409 SYSTEM_ROLE ; rôle attribué : 409 ROLE_IN_USE", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    const system = (await listRoles({ scope: "ORG" })).find((r) => r.systemKey === "MANAGER")!;
    const res = await PATCH(req("PATCH", { name: "Autre" }), ctx(org.id, system.id));
    expect([res.status, (await res.json()).error]).toEqual([409, "SYSTEM_ROLE"]);
    const role = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: ["org.read"] });
    const member = await makeOrgMember(org.id, "AUDITOR");
    await prisma.orgMembership.updateMany({ where: { userId: member.id }, data: { roleId: role.id } });
    const inUse = await DELETE(req("DELETE"), ctx(org.id, role.id));
    expect([inUse.status, (await inUse.json()).error]).toEqual([409, "ROLE_IN_USE"]);
  });

  it("anti-escalade sur PATCH : permission non détenue refusée (403)", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    const role = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: ["org.read"] });
    expect((await PATCH(req("PATCH", { permissions: ["org.roles.manage"] }), ctx(org.id, role.id))).status).toBe(403);
    expect((await PATCH(req("PATCH", { permissions: ["settings.update"] }), ctx(org.id, role.id))).status).toBe(400);
    expect((await PATCH(req("PATCH", { name: "x" }), ctx(org.id, role.id))).status).toBe(400);
  });

  it("un SUPER_ADMIN gère les rôles de n'importe quelle organisation", async () => {
    const org = await makeOrg();
    as(await makeStaff("SUPER_ADMIN"));
    const role = await makeCustomRole({ scope: "EVENT", orgId: org.id, permissions: ["scan.check-in"] });
    expect((await PATCH(req("PATCH", { description: "ok" }), ctx(org.id, role.id))).status).toBe(200);
  });
});
