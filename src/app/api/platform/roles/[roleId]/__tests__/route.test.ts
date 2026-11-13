import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeCustomRole, makeOrg, makeOrgMember, makeStaff, seedFactories } from "@/test/factories";
import { listRoles } from "@/lib/role-management";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { DELETE, GET, PATCH } from "../route";
import { POST as RESTORE } from "../restore/route";

beforeEach(() => {
  seedFactories(22);
  vi.mocked(getServerSession).mockReset();
});

function as(user: { id: string; email: string; name: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null);
}
const ctx = (roleId: string) => ({ params: Promise.resolve({ roleId }) });
const req = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/platform/roles/x", {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });

describe("/api/platform/roles/[roleId]", () => {
  it("401 sans session et 403 pour un STAFF_ADMIN, sur chaque méthode", async () => {
    const role = await makeCustomRole({ scope: "PLATFORM", permissions: [] });
    as(null);
    expect((await GET(req("GET"), ctx(role.id))).status).toBe(401);
    as(await makeStaff("STAFF_ADMIN"));
    expect((await GET(req("GET"), ctx(role.id))).status).toBe(403);
    expect((await PATCH(req("PATCH", { name: "Autre" }), ctx(role.id))).status).toBe(403);
    expect((await DELETE(req("DELETE"), ctx(role.id))).status).toBe(403);
    expect((await RESTORE(req("POST"), ctx(role.id))).status).toBe(403);
  });

  it("GET, PATCH puis archivage et restauration d'un rôle plateforme", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    const role = await makeCustomRole({ scope: "PLATFORM", name: "Initial", permissions: ["users.read"] });
    const got = await (await GET(req("GET"), ctx(role.id))).json();
    expect(got.role).toMatchObject({ id: role.id, name: "Initial", assignedCount: 0 });
    const patched = await PATCH(req("PATCH", { name: "Renommé", permissions: ["users.read", "plans.read"] }), ctx(role.id));
    expect(patched.status).toBe(200);
    expect((await patched.json()).role).toMatchObject({ name: "Renommé", permissions: ["plans.read", "users.read"] });
    expect((await (await DELETE(req("DELETE"), ctx(role.id))).json()).role.archived).toBe(true);
    expect((await (await RESTORE(req("POST"), ctx(role.id))).json()).role.archived).toBe(false);
  });

  it("PATCH d'un rôle système : 409 SYSTEM_ROLE ; corps invalide : 400", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    const system = (await listRoles({ scope: "PLATFORM" })).find((r) => r.systemKey === "STAFF_SUPPORT")!;
    const res = await PATCH(req("PATCH", { name: "Autre" }), ctx(system.id));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "SYSTEM_ROLE" });
    expect((await DELETE(req("DELETE"), ctx(system.id))).status).toBe(409);
    expect((await PATCH(req("PATCH", { name: "x" }), ctx(system.id))).status).toBe(400);
  });

  it("DELETE d'un rôle attribué : 409 ROLE_IN_USE", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    const role = await makeCustomRole({ scope: "PLATFORM", permissions: ["users.read"] });
    await makeStaff("STAFF_OBSERVER", { platformRoleId: role.id });
    const res = await DELETE(req("DELETE"), ctx(role.id));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "ROLE_IN_USE" });
  });

  it("404 : rôle inconnu, rôle d'organisation passé à une route plateforme", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    const org = await makeOrg();
    const orgRole = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: [] });
    for (const id of ["inconnu", orgRole.id]) {
      expect((await GET(req("GET"), ctx(id))).status).toBe(404);
      expect((await PATCH(req("PATCH", { name: "Autre" }), ctx(id))).status).toBe(404);
      expect((await DELETE(req("DELETE"), ctx(id))).status).toBe(404);
      expect((await RESTORE(req("POST"), ctx(id))).status).toBe(404);
    }
    expect(await prisma.role.count({ where: { id: orgRole.id, archived: false } })).toBe(1);
  });

  it("restauration : 409 ROLE_NAME_TAKEN si le nom est repris", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    const role = await makeCustomRole({ scope: "PLATFORM", name: "Nom", permissions: [] });
    await prisma.role.update({ where: { id: role.id }, data: { archived: true } });
    await makeCustomRole({ scope: "PLATFORM", name: "Nom", permissions: [] });
    expect((await RESTORE(req("POST"), ctx(role.id))).status).toBe(409);
  });

  it("un OWNER n'a pas accès", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    expect((await GET(req("GET"), ctx("x"))).status).toBe(403);
  });
});
