import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { GET, PUT } from "../route";

beforeEach(() => {
  seedFactories(41);
  vi.mocked(getServerSession).mockReset();
});

function as(user: { id: string; email: string; name: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null);
}
const ctx = (userId: string) => ({ params: Promise.resolve({ userId }) });
const get = (userId: string) => GET(new NextRequest(`http://localhost/api/platform/users/${userId}/permissions`), ctx(userId));
const put = (userId: string, body: unknown) =>
  PUT(
    new NextRequest(`http://localhost/api/platform/users/${userId}/permissions`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    ctx(userId),
  );

type Level = { target: { kind: string; orgName?: string }; effective: string[]; inherited: string[]; overrides: { permission: string; effect: string }[]; role: { systemKey: string | null } | null };

describe("permissions d'un utilisateur (plateforme)", () => {
  it("401 sans session ; 403 pour STAFF_ADMIN, STAFF_SUPPORT et un OWNER", async () => {
    const target = await makeUser();
    as(null);
    expect((await get(target.id)).status).toBe(401);
    for (const user of [await makeStaff("STAFF_ADMIN"), await makeStaff("STAFF_SUPPORT"), await makeOrgMember((await makeOrg()).id, "OWNER")]) {
      as(user);
      expect((await get(target.id)).status).toBe(403);
      expect((await put(target.id, { orgId: null, overrides: [] })).status).toBe(403);
    }
  });

  it("GET : niveau plateforme puis niveaux d'organisation ; 404 pour un compte inconnu", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    const org = await makeOrg({ name: "Acme" });
    const member = await makeOrgMember(org.id, "MANAGER");
    const { levels } = (await (await get(member.id)).json()) as { levels: Level[] };
    expect(levels.map((l) => l.target.kind)).toEqual(["platform", "org"]);
    expect(levels[1].target.orgName).toBe("Acme");
    expect(levels[1].role).toMatchObject({ systemKey: "MANAGER" });
    expect((await get("inconnu")).status).toBe(404);
  });

  it("SUPER_ADMIN retire registration.export au niveau plateforme puis l'ajoute au niveau organisation, effective suit", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    const org = await makeOrg();
    const member = await makeOrgMember(org.id, "MANAGER");
    const first = await put(member.id, { orgId: null, overrides: [{ permission: "registration.export", effect: "REVOKE" }] });
    expect(first.status).toBe(200);
    const platformLevel = (await first.json()).level as Level;
    expect(platformLevel.target.kind).toBe("platform");
    expect(platformLevel.overrides).toEqual([{ permission: "registration.export", effect: "REVOKE" }]);
    let { levels } = (await (await get(member.id)).json()) as { levels: Level[] };
    expect(levels[1].effective).not.toContain("registration.export");
    const second = await put(member.id, { orgId: org.id, overrides: [{ permission: "registration.export", effect: "GRANT" }] });
    expect(((await second.json()).level as Level).effective).toContain("registration.export");
    ({ levels } = (await (await get(member.id)).json()) as { levels: Level[] });
    expect(levels[1].effective).toContain("registration.export");
  });

  it("clés participant ajustables au niveau plateforme seulement ; deux PUT identiques : une ligne, un seul journal", async () => {
    const sa = await makeStaff("SUPER_ADMIN");
    as(sa);
    const user = await makeUser();
    const body = { orgId: null, overrides: [{ permission: "registration.self.create", effect: "REVOKE" }] };
    expect((await put(user.id, body)).status).toBe(200);
    expect((await put(user.id, body)).status).toBe(200);
    expect(await prisma.userPermissionOverride.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.activityLog.count({ where: { type: "USER_PERMISSIONS_CHANGED", targetId: user.id, userId: sa.id } })).toBe(1);
  });

  it("refus : soi-même 403, réservée 403, inconnue 400, organisation non membre 404, compte inconnu 404, corps invalide 400", async () => {
    const sa = await makeStaff("SUPER_ADMIN");
    as(sa);
    const org = await makeOrg();
    const user = await makeUser();
    const err = async (r: Promise<Response>) => { const res = await r; return [res.status, (await res.json()).error]; };
    expect(await err(put(sa.id, { orgId: null, overrides: [] }))).toEqual([403, "SELF_MODIFICATION"]);
    expect(await err(put(user.id, { orgId: null, overrides: [{ permission: "platform.roles.manage", effect: "GRANT" }] }))).toEqual([403, "RESERVED_PERMISSION"]);
    expect(await err(put(user.id, { orgId: null, overrides: [{ permission: "nope", effect: "GRANT" }] }))).toEqual([400, "INVALID_PERMISSION"]);
    expect(await err(put(user.id, { orgId: org.id, overrides: [] }))).toEqual([404, "NOT_FOUND"]);
    expect(await err(put("inconnu", { orgId: null, overrides: [] }))).toEqual([404, "NOT_FOUND"]);
    expect((await put(user.id, { overrides: [] })).status).toBe(400);
    expect((await put(user.id, { orgId: null, overrides: [{ permission: "x", effect: "MAYBE" }] })).status).toBe(400);
  });
});
