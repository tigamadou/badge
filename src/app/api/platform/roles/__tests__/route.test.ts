import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeCustomRole, makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { GET, POST } from "../route";

beforeEach(() => {
  seedFactories(21);
  vi.mocked(getServerSession).mockReset();
});

function as(user: { id: string; email: string; name: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null);
}

const url = (q = "") => `http://localhost/api/platform/roles${q}`;
const post = (body: unknown) =>
  new NextRequest(url(), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const params = { params: Promise.resolve({}) };

describe("GET /api/platform/roles", () => {
  it("401 sans session, 403 pour STAFF_ADMIN, STAFF_SUPPORT et un participant", async () => {
    as(null);
    expect((await GET(new NextRequest(url()), params)).status).toBe(401);
    for (const user of [await makeStaff("STAFF_ADMIN"), await makeStaff("STAFF_SUPPORT"), await makeUser()]) {
      as(user);
      expect((await GET(new NextRequest(url()), params)).status).toBe(403);
    }
  });

  it("liste les rôles plateforme par défaut, et les rôles système ORG / EVENT en lecture", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    const org = await makeOrg();
    await makeCustomRole({ scope: "PLATFORM", name: "Maison", permissions: ["users.read"] });
    await makeCustomRole({ scope: "ORG", orgId: org.id, name: "Org seulement", permissions: ["org.read"] });
    const platform = await (await GET(new NextRequest(url()), params)).json();
    expect(platform.roles.map((r: { name: string }) => r.name)).toEqual([
      "Super administrateur", "Administrateur", "Support", "Imprimeur", "Observateur", "Maison",
    ]);
    const orgRoles = await (await GET(new NextRequest(url("?scope=ORG")), params)).json();
    expect(orgRoles.roles.map((r: { systemKey: string }) => r.systemKey)).toEqual(["OWNER", "MANAGER", "AUDITOR", "AGENT"]);
    const events = await (await GET(new NextRequest(url("?scope=EVENT")), params)).json();
    expect(events.roles).toHaveLength(4);
  });

  it("archived=true inclut les rôles archivés ; scope invalide : 400", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    const role = await makeCustomRole({ scope: "PLATFORM", permissions: [] });
    await prisma.role.update({ where: { id: role.id }, data: { archived: true } });
    const without = await (await GET(new NextRequest(url()), params)).json();
    const withArchived = await (await GET(new NextRequest(url("?archived=true")), params)).json();
    expect(withArchived.roles.length).toBe(without.roles.length + 1);
    expect((await GET(new NextRequest(url("?scope=PARTICIPANT")), params)).status).toBe(400);
  });
});

describe("POST /api/platform/roles", () => {
  it("403 pour STAFF_ADMIN, 401 sans session", async () => {
    as(null);
    expect((await POST(post({ name: "Abc", permissions: [] }), params)).status).toBe(401);
    as(await makeStaff("STAFF_ADMIN"));
    expect((await POST(post({ name: "Abc", permissions: [] }), params)).status).toBe(403);
  });

  it("SUPER_ADMIN crée un rôle (201) avec journal", async () => {
    const sa = await makeStaff("SUPER_ADMIN");
    as(sa);
    const res = await POST(post({ name: "Lecteur", description: "x", permissions: ["users.read", "org.read"] }), params);
    expect(res.status).toBe(201);
    const { role } = await res.json();
    expect(role).toMatchObject({ scope: "PLATFORM", name: "Lecteur", permissions: ["users.read", "org.read"] });
    expect(await prisma.activityLog.count({ where: { type: "ROLE_CREATED", userId: sa.id, targetId: role.id } })).toBe(1);
  });

  it("doublon 409, réservée 403, inconnue et hors niveau 400, corps invalide 400", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    await POST(post({ name: "Doublon", permissions: [] }), params);
    expect(await (await POST(post({ name: "Doublon", permissions: [] }), params)).json()).toEqual({ error: "ROLE_NAME_TAKEN" });
    expect((await POST(post({ name: "Rés", permissions: ["platform.roles.manage"] }), params)).status).toBe(403);
    expect((await POST(post({ name: "Inc", permissions: ["nope"] }), params)).status).toBe(400);
    expect((await POST(post({ name: "Part", permissions: ["account.profile.update"] }), params)).status).toBe(400);
    expect((await POST(post({ name: "A", permissions: [] }), params)).status).toBe(400);
    expect((await POST(post({ name: "Abc", permissions: [], extra: 1 }), params)).status).toBe(400);
    expect((await POST(new NextRequest(url(), { method: "POST", body: "pas du json" }), params)).status).toBe(400);
  });

  it("un OWNER n'a pas accès", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    expect((await POST(post({ name: "Abc", permissions: [] }), params)).status).toBe(403);
  });
});
