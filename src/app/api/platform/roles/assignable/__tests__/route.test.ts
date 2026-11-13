import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeCustomRole, makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { GET } from "../route";

beforeEach(() => {
  seedFactories(23);
  vi.mocked(getServerSession).mockReset();
});

function as(user: { id: string; email: string; name: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null);
}
const call = (q: string) => GET(new NextRequest(`http://localhost/api/platform/roles/assignable${q}`), { params: Promise.resolve({}) });

type Row = { systemKey: string | null; name: string; assignable: boolean; reason?: string; permissions?: unknown };

describe("GET /api/platform/roles/assignable", () => {
  it("401 sans session, 403 pour un participant", async () => {
    as(null);
    expect((await call("?scope=PLATFORM")).status).toBe(401);
    as(await makeUser());
    expect((await call("?scope=PLATFORM")).status).toBe(403);
  });

  it("STAFF_ADMIN : SUPER_ADMIN non assignable avec raison, STAFF_PRINTER assignable, rôle personnalisé selon ses permissions", async () => {
    as(await makeStaff("STAFF_ADMIN"));
    await makeCustomRole({ scope: "PLATFORM", name: "Léger", permissions: ["users.read"] });
    await makeCustomRole({ scope: "PLATFORM", name: "Secrets", permissions: ["settings.secrets.update"] });
    const { roles } = (await (await call("?scope=PLATFORM")).json()) as { roles: Row[] };
    const by = (n: string) => roles.find((r) => r.name === n)!;
    expect(by("Super administrateur")).toMatchObject({ assignable: false });
    expect(by("Super administrateur").reason).toMatch(/Vous ne détenez pas la permission/);
    expect(by("Imprimeur").assignable).toBe(true);
    expect(by("Léger")).toMatchObject({ assignable: true });
    expect(by("Léger").reason).toBeUndefined();
    expect(roles.every((r) => r.permissions === undefined)).toBe(true);
  });

  it("scope=ORG : rôles système et personnalisés de l'organisation ; STAFF_ADMIN peut attribuer OWNER", async () => {
    as(await makeStaff("STAFF_ADMIN"));
    const [a, b] = [await makeOrg(), await makeOrg()];
    await makeCustomRole({ scope: "ORG", orgId: a.id, name: "De A", permissions: ["org.read"] });
    await makeCustomRole({ scope: "ORG", orgId: b.id, name: "De B", permissions: ["org.read"] });
    const { roles } = (await (await call(`?scope=ORG&orgId=${a.id}`)).json()) as { roles: Row[] };
    expect(roles.map((r) => r.name)).toEqual(["Propriétaire", "Gestionnaire", "Auditeur", "Agent", "De A"]);
    expect(roles.every((r) => r.assignable)).toBe(true);
  });

  it("400 sans orgId pour ORG ou scope inconnu ; 404 organisation inconnue", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    expect((await call("?scope=ORG")).status).toBe(400);
    expect((await call("?scope=EVENT")).status).toBe(400);
    expect((await call("")).status).toBe(400);
    expect((await call("?scope=ORG&orgId=inconnue")).status).toBe(404);
  });

  it("un OWNER n'a pas accès aux routes plateforme", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    expect((await call("?scope=PLATFORM")).status).toBe(403);
  });
});
