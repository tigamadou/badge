import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeCustomRole, makeOrg, makeOrgMember, makeOverride, makeStaff, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { GET, POST } from "../route";

beforeEach(() => {
  seedFactories(31);
  vi.mocked(getServerSession).mockReset();
});

function as(user: { id: string; email: string; name: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null);
}
const ctx = (orgId: string) => ({ params: Promise.resolve({ orgId }) });
const url = (orgId: string, q = "") => `http://localhost/api/org/${orgId}/roles${q}`;
const post = (orgId: string, body: unknown) =>
  POST(new NextRequest(url(orgId), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), ctx(orgId));

describe("GET /api/org/[orgId]/roles", () => {
  it("401 sans session ; 403 pour MANAGER, AUDITOR, AGENT et un membre d'une autre organisation", async () => {
    const org = await makeOrg();
    as(null);
    expect((await GET(new NextRequest(url(org.id)), ctx(org.id))).status).toBe(401);
    for (const role of ["MANAGER", "AUDITOR", "AGENT"] as const) {
      as(await makeOrgMember(org.id, role));
      expect((await GET(new NextRequest(url(org.id)), ctx(org.id))).status).toBe(403);
    }
    as(await makeOrgMember((await makeOrg()).id, "OWNER"));
    expect((await GET(new NextRequest(url(org.id)), ctx(org.id))).status).toBe(403);
  });

  it("liste les rôles système et ceux de l'organisation seulement ; filtres scope et archived", async () => {
    const [a, b] = [await makeOrg(), await makeOrg()];
    as(await makeOrgMember(a.id, "OWNER"));
    await makeCustomRole({ scope: "ORG", orgId: a.id, name: "De A", permissions: ["org.read"] });
    await makeCustomRole({ scope: "ORG", orgId: b.id, name: "De B", permissions: ["org.read"] });
    const old = await makeCustomRole({ scope: "EVENT", orgId: a.id, name: "Ancien A", permissions: ["event.update"] });
    await prisma.role.update({ where: { id: old.id }, data: { archived: true } });
    const names = async (q: string) => ((await (await GET(new NextRequest(url(a.id, q)), ctx(a.id))).json()).roles as { name: string }[]).map((r) => r.name);
    expect(await names("")).toEqual(["Propriétaire", "Gestionnaire", "Auditeur", "Agent", "De A"]);
    expect(await names("?scope=EVENT")).toEqual(["Administrateur d'évènement", "Opérateur", "Imprimeur d'évènement", "Lecteur"]);
    expect(await names("?scope=EVENT&archived=true")).toContain("Ancien A");
    expect((await GET(new NextRequest(url(a.id, "?scope=PLATFORM")), ctx(a.id))).status).toBe(400);
  });

  it("404 pour un SUPER_ADMIN sur une organisation inconnue", async () => {
    as(await makeStaff("SUPER_ADMIN"));
    expect((await GET(new NextRequest(url("inconnue")), ctx("inconnue"))).status).toBe(404);
  });
});

describe("POST /api/org/[orgId]/roles", () => {
  it("MANAGER, AUDITOR, AGENT : 403", async () => {
    const org = await makeOrg();
    for (const role of ["MANAGER", "AUDITOR", "AGENT"] as const) {
      as(await makeOrgMember(org.id, role));
      expect((await post(org.id, { scope: "ORG", name: "Abc", permissions: [] })).status).toBe(403);
    }
  });

  it("OWNER crée un rôle ORG (201) et un rôle EVENT, journalisé avec l'organisation", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    as(owner);
    const res = await post(org.id, { scope: "ORG", name: "Événementiel", permissions: ["org.events.create", "org.read"] });
    expect(res.status).toBe(201);
    const { role } = await res.json();
    expect(role).toMatchObject({ scope: "ORG", orgId: org.id, permissions: ["org.read", "org.events.create"] });
    expect(await prisma.activityLog.count({ where: { type: "ROLE_CREATED", orgId: org.id, userId: owner.id } })).toBe(1);
    expect((await post(org.id, { scope: "EVENT", name: "Scanner", permissions: ["scan.check-in"] })).status).toBe(201);
  });

  it("refus : org.roles.manage (403 RESERVED), settings.update (400 INVALID), permission retirée par ajustement (403 NOT_HELD)", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    as(owner);
    const body = (permissions: string[]) => ({ scope: "ORG", name: "Refusé", permissions });
    const reserved = await post(org.id, body(["org.roles.manage"]));
    expect([reserved.status, (await reserved.json()).error]).toEqual([403, "RESERVED_PERMISSION"]);
    const invalid = await post(org.id, body(["settings.update"]));
    expect([invalid.status, (await invalid.json()).error]).toEqual([400, "INVALID_PERMISSION"]);
    const eventLevel = await post(org.id, { scope: "EVENT", name: "Refusé", permissions: ["org.read"] });
    expect(eventLevel.status).toBe(400);
    await makeOverride({ userId: owner.id, orgId: org.id, permission: "org.events.create", effect: "REVOKE" });
    const notHeld = await post(org.id, body(["org.events.create"]));
    expect([notHeld.status, (await notHeld.json()).error]).toEqual([403, "PERMISSION_NOT_HELD"]);
  });

  it("deux organisations peuvent porter le même nom ; doublon dans une même organisation : 409", async () => {
    const [a, b] = [await makeOrg(), await makeOrg()];
    as(await makeOrgMember(a.id, "OWNER"));
    expect((await post(a.id, { scope: "ORG", name: "Commun", permissions: [] })).status).toBe(201);
    expect((await post(a.id, { scope: "ORG", name: "Commun", permissions: [] })).status).toBe(409);
    as(await makeOrgMember(b.id, "OWNER"));
    expect((await post(b.id, { scope: "ORG", name: "Commun", permissions: [] })).status).toBe(201);
  });

  it("corps invalide : 400 (scope absent, champ inconnu, orgId dans le corps ignoré par strict)", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    expect((await post(org.id, { name: "Abc", permissions: [] })).status).toBe(400);
    expect((await post(org.id, { scope: "ORG", name: "Abc", permissions: [], orgId: "autre" })).status).toBe(400);
  });

  it("un SUPER_ADMIN passe la garde et est journalisé comme staff ; 404 pour une organisation inconnue", async () => {
    const org = await makeOrg();
    const sa = await makeStaff("SUPER_ADMIN");
    as(sa);
    expect((await post(org.id, { scope: "ORG", name: "Par staff", permissions: ["org.events.archive"] })).status).toBe(201);
    expect(await prisma.activityLog.count({ where: { type: "ROLE_CREATED", orgId: org.id, staffActor: true } })).toBe(1);
    expect((await post("inconnue", { scope: "ORG", name: "Abc", permissions: [] })).status).toBe(404);
  });
});
