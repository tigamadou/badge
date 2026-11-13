import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { systemRoleId } from "@/lib/permissions/db";
import { makeCustomRole, makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

// SMTP réel (mailpit) : l'envoi d'invitation est simulé pour pouvoir provoquer un échec.
vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return { ...actual, sendUserInvitation: vi.fn().mockResolvedValue(undefined) };
});
import { sendUserInvitation } from "@/lib/mail";
import { GET, POST } from "@/app/api/org/[orgId]/members/route";
import { DELETE, PATCH } from "@/app/api/org/[orgId]/members/[userId]/route";

beforeEach(() => {
  seedFactories(61);
  vi.mocked(getServerSession).mockReset();
  vi.mocked(sendUserInvitation).mockReset().mockResolvedValue(undefined);
});

function as(user: { id: string; email: string; name: string; isStaff?: boolean } | null) {
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user: { isStaff: false, ...user } } as never) : null);
}
const base = (orgId: string) => `http://localhost/api/org/${orgId}/members`;
const json = (method: string, url: string, body?: unknown) =>
  new NextRequest(url, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "content-type": "application/json" } });
const orgCtx = (orgId: string) => ({ params: Promise.resolve({ orgId }) });
const userCtx = (orgId: string, userId: string) => ({ params: Promise.resolve({ orgId, userId }) });
const role = (key: Parameters<typeof systemRoleId>[1]) => systemRoleId(prisma, key);

describe("GET /api/org/[orgId]/members", () => {
  it("401 sans session ; 403 pour AGENT et pour un membre d'une autre organisation", async () => {
    const org = await makeOrg();
    as(null);
    expect((await GET(json("GET", base(org.id)), orgCtx(org.id))).status).toBe(401);
    as(await makeOrgMember(org.id, "AGENT"));
    expect((await GET(json("GET", base(org.id)), orgCtx(org.id))).status).toBe(403);
    as(await makeOrgMember((await makeOrg()).id, "OWNER"));
    expect((await GET(json("GET", base(org.id)), orgCtx(org.id))).status).toBe(403);
  });

  it("OWNER, MANAGER et AUDITOR listent les membres avec le rôle, invitedAt et lastLoginAt", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    const auditor = await makeOrgMember(org.id, "AUDITOR");
    await prisma.activityLog.create({ data: { type: "USER_LOGIN", userId: owner.id } });
    for (const who of [owner, auditor, await makeOrgMember(org.id, "MANAGER")]) {
      as(who);
      const res = await GET(json("GET", base(org.id)), orgCtx(org.id));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.members).toHaveLength(3);
      const me = body.members.find((m: { userId: string }) => m.userId === owner.id);
      expect(me.role).toMatchObject({ systemKey: "OWNER", name: "Propriétaire" });
      expect(me.lastLoginAt).not.toBeNull();
      expect(body.members.find((m: { userId: string }) => m.userId === auditor.id).lastLoginAt).toBeNull();
    }
  });

  it("un membre à rôle personnalisé avec org.members.read liste ; un membre sans roleId est vu par son enum", async () => {
    const org = await makeOrg();
    const custom = await makeCustomRole({ scope: "ORG", orgId: org.id, name: "Lecteur membres", permissions: ["org.members.read"] });
    const reader = await makeUser();
    await prisma.orgMembership.create({ data: { userId: reader.id, orgId: org.id, roleId: custom.id } });
    const legacy = await makeUser();
    await prisma.orgMembership.create({ data: { userId: legacy.id, orgId: org.id, role: "AUDITOR" } });
    as(reader);
    const body = await (await GET(json("GET", base(org.id)), orgCtx(org.id))).json();
    const byId = Object.fromEntries(body.members.map((m: { userId: string; role: unknown }) => [m.userId, m.role]));
    expect(byId[reader.id]).toMatchObject({ id: custom.id, name: "Lecteur membres", systemKey: null });
    expect(byId[legacy.id]).toMatchObject({ systemKey: "AUDITOR" });
  });
});

describe("POST /api/org/[orgId]/members", () => {
  it("401 ; 403 pour MANAGER, AUDITOR et AGENT", async () => {
    const org = await makeOrg();
    const body = { email: "x@test.fr", name: "X", roleId: await role("AGENT") };
    as(null);
    expect((await POST(json("POST", base(org.id), body), orgCtx(org.id))).status).toBe(401);
    for (const r of ["MANAGER", "AUDITOR", "AGENT"] as const) {
      as(await makeOrgMember(org.id, r));
      expect((await POST(json("POST", base(org.id), body), orgCtx(org.id))).status).toBe(403);
    }
  });

  it("400 sur corps invalide, JSON illisible, ancien champ role ; 404 pour un rôle inconnu ou d'une autre organisation ; 400 pour un rôle de portée évènement", async () => {
    const org = await makeOrg();
    const other = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    const post = (b: unknown) => POST(json("POST", base(org.id), b), orgCtx(org.id));
    expect((await post({ email: "x@test.fr", name: "X", role: "MANAGER" })).status).toBe(400);
    expect((await post({ email: "pas-un-mail", name: "X", roleId: "r" })).status).toBe(400);
    expect(
      (await POST(new NextRequest(base(org.id), { method: "POST", body: "{x", headers: { "content-type": "application/json" } }), orgCtx(org.id))).status,
    ).toBe(400);
    const foreign = await makeCustomRole({ scope: "ORG", orgId: other.id, permissions: ["org.read"] });
    for (const roleId of ["inconnu", foreign.id]) {
      expect((await post({ email: "x@test.fr", name: "X", roleId })).status).toBe(404);
    }
    expect((await post({ email: "x@test.fr", name: "X", roleId: await role("VIEWER") })).status).toBe(400);
    expect(await prisma.user.findUnique({ where: { email: "x@test.fr" } })).toBeNull();
  });

  it("crée l'utilisateur invité, l'appartenance (roleId + enum), le journal et l'invitation", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    as(owner);
    const res = await POST(json("POST", base(org.id), { email: "New@Test.fr", name: "Nouveau", roleId: await role("MANAGER") }), orgCtx(org.id));
    expect(res.status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "new@test.fr" } });
    expect(user.inviteToken).not.toBeNull();
    const m = await prisma.orgMembership.findFirstOrThrow({ where: { userId: user.id, orgId: org.id }, include: { roleRef: true } });
    expect(m.roleRef?.systemKey).toBe("MANAGER");
    expect(m.role).toBe("MANAGER");
    expect(sendUserInvitation).toHaveBeenCalledWith(user.id, { orgId: org.id });
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "MEMBERSHIP_ADDED", targetId: user.id } });
    expect(log.details).toMatchObject({ role: "MANAGER", isNewUser: true });
    expect(await prisma.activityLog.count({ where: { type: "USER_CREATED", targetId: user.id } })).toBe(1);
  });

  it("l'appartenance est créée même si l'email d'invitation échoue", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    vi.mocked(sendUserInvitation).mockRejectedValueOnce(new Error("smtp"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await POST(json("POST", base(org.id), { email: "echec@test.fr", name: "E", roleId: await role("AGENT") }), orgCtx(org.id));
    spy.mockRestore();
    expect(res.status).toBe(201);
    expect(await prisma.orgMembership.count({ where: { orgId: org.id } })).toBe(2);
  });

  it("utilisateur existant : ajouté sans invitation ; déjà membre : 200 alreadyMember sans doublon", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    const existing = await makeUser();
    const body = { email: existing.email, name: existing.name, roleId: await role("AUDITOR") };
    const first = await POST(json("POST", base(org.id), body), orgCtx(org.id));
    expect(first.status).toBe(201);
    expect(sendUserInvitation).not.toHaveBeenCalled();
    const again = await POST(json("POST", base(org.id), body), orgCtx(org.id));
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ alreadyMember: true });
    expect(await prisma.orgMembership.count({ where: { userId: existing.id, orgId: org.id } })).toBe(1);
  });

  it("anti-escalade : un rôle personnalisé ne donne que ce qu'il détient (403 PERMISSION_NOT_HELD) ; un rôle personnalisé de l'organisation est attribuable", async () => {
    const org = await makeOrg();
    const limited = await makeCustomRole({ scope: "ORG", orgId: org.id, name: "Admin membres", permissions: ["org.members.manage", "org.members.read", "org.read"] });
    const actor = await makeUser();
    await prisma.orgMembership.create({ data: { userId: actor.id, orgId: org.id, roleId: limited.id } });
    as(actor);
    const forbidden = await POST(json("POST", base(org.id), { email: "a@test.fr", name: "A", roleId: await role("OWNER") }), orgCtx(org.id));
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error).toBe("PERMISSION_NOT_HELD");
    const mine = await makeCustomRole({ scope: "ORG", orgId: org.id, name: "Petit", permissions: ["org.read"] });
    const ok = await POST(json("POST", base(org.id), { email: "b@test.fr", name: "B", roleId: mine.id }), orgCtx(org.id));
    expect(ok.status).toBe(201);
    const created = await prisma.user.findUniqueOrThrow({ where: { email: "b@test.fr" } });
    const m = await prisma.orgMembership.findFirstOrThrow({ where: { userId: created.id } });
    expect(m.roleId).toBe(mine.id);
    expect(m.role).toBeNull();
  });

  it("le staff (STAFF_ADMIN) peut attribuer le rôle OWNER sans appartenance", async () => {
    const org = await makeOrg();
    as(await makeStaff("STAFF_ADMIN"));
    const res = await POST(json("POST", base(org.id), { email: "own@test.fr", name: "O", roleId: await role("OWNER") }), orgCtx(org.id));
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/org/[orgId]/members/[userId]", () => {
  const patch = (orgId: string, userId: string, body: unknown) => PATCH(json("PATCH", `${base(orgId)}/${userId}`, body), userCtx(orgId, userId));

  it("401 ; 403 pour MANAGER ; 400 corps invalide ; 404 membre inconnu", async () => {
    const org = await makeOrg();
    const target = await makeOrgMember(org.id, "AGENT");
    as(null);
    expect((await patch(org.id, target.id, { roleId: await role("AUDITOR") })).status).toBe(401);
    as(await makeOrgMember(org.id, "MANAGER"));
    expect((await patch(org.id, target.id, { roleId: await role("AUDITOR") })).status).toBe(403);
    as(await makeOrgMember(org.id, "OWNER"));
    expect((await patch(org.id, target.id, { role: "AUDITOR" })).status).toBe(400);
    expect(
      (await PATCH(new NextRequest(`${base(org.id)}/${target.id}`, { method: "PATCH", body: "{x" }), userCtx(org.id, target.id))).status,
    ).toBe(400);
    expect((await patch(org.id, "inconnu", { roleId: await role("AUDITOR") })).status).toBe(404);
  });

  it("change le rôle : double écriture, journal, et même rôle = sans effet", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    const target = await makeOrgMember(org.id, "MANAGER");
    const res = await patch(org.id, target.id, { roleId: await role("AUDITOR") });
    expect(res.status).toBe(200);
    expect((await res.json()).membership.role).toMatchObject({ systemKey: "AUDITOR" });
    const m = await prisma.orgMembership.findFirstOrThrow({ where: { userId: target.id }, include: { roleRef: true } });
    expect(m.roleRef?.systemKey).toBe("AUDITOR");
    expect(m.role).toBe("AUDITOR");
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "MEMBERSHIP_ROLE_CHANGED", targetId: target.id } });
    expect(log.details).toMatchObject({ from: "MANAGER", to: "AUDITOR" });
    const same = await patch(org.id, target.id, { roleId: await role("AUDITOR") });
    expect(same.status).toBe(200);
    expect(await prisma.activityLog.count({ where: { type: "MEMBERSHIP_ROLE_CHANGED" } })).toBe(1);
  });

  it("refuse la modification de son propre rôle (SELF_MODIFICATION)", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    await makeOrgMember(org.id, "OWNER");
    as(owner);
    const res = await patch(org.id, owner.id, { roleId: await role("MANAGER") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("SELF_MODIFICATION");
  });

  it("un propriétaire non staff ne touche pas un autre propriétaire (OWNER_PROTECTED) ; un SUPER_ADMIN le peut", async () => {
    const org = await makeOrg();
    const ownerA = await makeOrgMember(org.id, "OWNER");
    const ownerB = await makeOrgMember(org.id, "OWNER");
    as(ownerA);
    const res = await patch(org.id, ownerB.id, { roleId: await role("MANAGER") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("OWNER_PROTECTED");
    as(await makeStaff("SUPER_ADMIN"));
    expect((await patch(org.id, ownerB.id, { roleId: await role("MANAGER") })).status).toBe(200);
  });

  it("le dernier propriétaire ne peut pas être rétrogradé (409 LAST_OWNER)", async () => {
    const org = await makeOrg();
    const sole = await makeOrgMember(org.id, "OWNER");
    as(await makeStaff("SUPER_ADMIN"));
    const res = await patch(org.id, sole.id, { roleId: await role("MANAGER") });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("LAST_OWNER");
  });

  it("anti-escalade : on n'attribue pas un rôle qu'on ne détient pas (403) ; 404 pour un rôle d'une autre organisation", async () => {
    const org = await makeOrg();
    const limited = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: ["org.members.manage", "org.read"] });
    const actor = await makeUser();
    await prisma.orgMembership.create({ data: { userId: actor.id, orgId: org.id, roleId: limited.id } });
    const target = await makeOrgMember(org.id, "AGENT");
    as(actor);
    expect((await patch(org.id, target.id, { roleId: await role("MANAGER") })).status).toBe(403);
    const foreign = await makeCustomRole({ scope: "ORG", orgId: (await makeOrg()).id, permissions: ["org.read"] });
    expect((await patch(org.id, target.id, { roleId: foreign.id })).status).toBe(404);
  });

  it("un membre hérité (enum seul) est retrouvé comme propriétaire", async () => {
    const org = await makeOrg();
    const legacy = await makeUser();
    await prisma.orgMembership.create({ data: { userId: legacy.id, orgId: org.id, role: "OWNER" } });
    as(await makeStaff("SUPER_ADMIN"));
    const res = await patch(org.id, legacy.id, { roleId: await role("MANAGER") });
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/org/[orgId]/members/[userId]", () => {
  const del = (orgId: string, userId: string) => DELETE(json("DELETE", `${base(orgId)}/${userId}`), userCtx(orgId, userId));

  it("401 ; 403 pour MANAGER ; 404 membre inconnu", async () => {
    const org = await makeOrg();
    const target = await makeOrgMember(org.id, "AGENT");
    as(null);
    expect((await del(org.id, target.id)).status).toBe(401);
    as(await makeOrgMember(org.id, "MANAGER"));
    expect((await del(org.id, target.id)).status).toBe(403);
    as(await makeOrgMember(org.id, "OWNER"));
    expect((await del(org.id, "inconnu")).status).toBe(404);
  });

  it("retire un membre (204) et journalise", async () => {
    const org = await makeOrg();
    as(await makeOrgMember(org.id, "OWNER"));
    const target = await makeOrgMember(org.id, "AGENT");
    expect((await del(org.id, target.id)).status).toBe(204);
    expect(await prisma.orgMembership.count({ where: { userId: target.id } })).toBe(0);
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "MEMBERSHIP_REMOVED", targetId: target.id } });
    expect(log.details).toMatchObject({ role: "AGENT" });
  });

  it("propriétaire : OWNER_PROTECTED pour un autre propriétaire, dernier propriétaire protégé, départ volontaire permis s'il en reste un", async () => {
    const org = await makeOrg();
    const a = await makeOrgMember(org.id, "OWNER");
    const b = await makeOrgMember(org.id, "OWNER");
    as(a);
    const res = await del(org.id, b.id);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("OWNER_PROTECTED");
    expect((await del(org.id, a.id)).status).toBe(204);
    as(b);
    const last = await del(org.id, b.id);
    expect(last.status).toBe(409);
    expect((await last.json()).error).toBe("LAST_OWNER");
  });
});
