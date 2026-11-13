import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeOrg, makeOrgMember, makeOverride, makeStaff, makeUser, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { GET, PUT } from "../route";

beforeEach(() => {
  seedFactories(42);
  vi.mocked(getServerSession).mockReset();
});

function as(user: { id: string; email: string; name: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null);
}
const ctx = (orgId: string, userId: string) => ({ params: Promise.resolve({ orgId, userId }) });
const get = (orgId: string, userId: string) => GET(new NextRequest("http://localhost/x"), ctx(orgId, userId));
const put = (orgId: string, userId: string, body: unknown) =>
  PUT(new NextRequest("http://localhost/x", { method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), ctx(orgId, userId));
const overrides = (...list: [string, "GRANT" | "REVOKE"][]) => ({ overrides: list.map(([permission, effect]) => ({ permission, effect })) });
const err = async (r: Promise<Response>) => { const res = await r; return [res.status, (await res.json()).error]; };

describe("permissions d'un membre (organisation)", () => {
  it("401 sans session ; 403 pour MANAGER, AUDITOR, AGENT", async () => {
    const org = await makeOrg();
    const target = await makeOrgMember(org.id, "AUDITOR");
    as(null);
    expect((await get(org.id, target.id)).status).toBe(401);
    for (const role of ["MANAGER", "AUDITOR", "AGENT"] as const) {
      as(await makeOrgMember(org.id, role));
      expect((await get(org.id, target.id)).status).toBe(403);
      expect((await put(org.id, target.id, overrides())).status).toBe(403);
    }
  });

  it("OWNER retire event.update à un MANAGER, l'ajoute à un AUDITOR ; GET renvoie un seul niveau", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    as(owner);
    const manager = await makeOrgMember(org.id, "MANAGER");
    const auditor = await makeOrgMember(org.id, "AUDITOR");
    const removed = await put(org.id, manager.id, overrides(["event.update", "REVOKE"]));
    expect(removed.status).toBe(200);
    expect((await removed.json()).level.effective).not.toContain("event.update");
    const added = await put(org.id, auditor.id, overrides(["event.update", "GRANT"]));
    expect((await added.json()).level.effective).toContain("event.update");
    const { levels } = await (await get(org.id, auditor.id)).json();
    expect(levels).toHaveLength(1);
    expect(levels[0]).toMatchObject({ target: { kind: "org", orgId: org.id }, role: { systemKey: "AUDITOR" } });
    expect(await prisma.activityLog.count({ where: { type: "USER_PERMISSIONS_CHANGED", orgId: org.id, userId: owner.id } })).toBe(2);
  });

  it("l'OWNER ne peut accorder ni settings.update (400) ni org.roles.manage (403)", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    const target = await makeOrgMember(org.id, "MANAGER");
    expect(await err(put(org.id, target.id, overrides(["settings.update", "GRANT"])))).toEqual([400, "INVALID_PERMISSION"]);
    expect(await err(put(org.id, target.id, overrides(["org.roles.manage", "GRANT"])))).toEqual([403, "RESERVED_PERMISSION"]);
  });

  it("OWNER sur un autre OWNER : 403 OWNER_PROTECTED ; sur lui-même : 403 SELF_MODIFICATION ; SUPER_ADMIN peut", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    const other = await makeOrgMember(org.id, "OWNER");
    as(owner);
    expect(await err(put(org.id, other.id, overrides(["event.update", "REVOKE"])))).toEqual([403, "OWNER_PROTECTED"]);
    expect(await err(put(org.id, owner.id, overrides()))).toEqual([403, "SELF_MODIFICATION"]);
    as(await makeStaff("SUPER_ADMIN"));
    expect((await put(org.id, other.id, overrides(["event.update", "REVOKE"]))).status).toBe(200);
  });

  it("IDOR : l'OWNER de A sur un membre de B ou un non-membre : 404, aucune ligne écrite", async () => {
    const [a, b] = [await makeOrg(), await makeOrg()];
    as(await makeOrgMember(a.id, "OWNER"));
    const inB = await makeOrgMember(b.id, "MANAGER");
    const nobody = await makeUser();
    for (const id of [inB.id, nobody.id, "inconnu"]) {
      expect(await err(get(a.id, id).then((r) => r))).toEqual([404, "NOT_FOUND"]);
      expect(await err(put(a.id, id, overrides(["event.update", "REVOKE"])))).toEqual([404, "NOT_FOUND"]);
    }
    expect(await prisma.userPermissionOverride.count()).toBe(0);
  });

  it("l'ajustement d'une organisation n'affecte pas les autres ; corps invalide : 400", async () => {
    const [a, b] = [await makeOrg(), await makeOrg()];
    as(await makeOrgMember(a.id, "OWNER"));
    const member = await makeOrgMember(a.id, "MANAGER");
    await prisma.orgMembership.create({ data: { userId: member.id, orgId: b.id, roleId: (await prisma.orgMembership.findFirstOrThrow({ where: { userId: member.id } })).roleId } });
    await makeOverride({ userId: member.id, orgId: b.id, permission: "event.update", effect: "REVOKE" });
    expect((await put(a.id, member.id, overrides(["event.update", "REVOKE"]))).status).toBe(200);
    expect((await put(a.id, member.id, overrides())).status).toBe(200);
    expect(await prisma.userPermissionOverride.count({ where: { userId: member.id, orgId: b.id } })).toBe(1);
    expect((await put(a.id, member.id, {})).status).toBe(400);
    expect((await put(a.id, member.id, { overrides: [], orgId: b.id })).status).toBe(400);
  });
});
