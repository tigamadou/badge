import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { systemRoleId } from "@/lib/permissions/db";
import { makeCustomRole, makeEvent, makeEventMember, makeOrg, makeStaff, makeUser, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

// SMTP réel (mailpit) : l'envoi d'invitation est simulé pour pouvoir provoquer un échec.
vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return { ...actual, sendUserInvitation: vi.fn().mockResolvedValue(undefined) };
});
import { sendUserInvitation } from "@/lib/mail";
import { GET, POST } from "@/app/api/org/[orgId]/events/[eventId]/members/route";
import { DELETE, PATCH } from "@/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route";

beforeEach(() => {
  seedFactories(71);
  vi.mocked(getServerSession).mockReset();
  vi.mocked(sendUserInvitation).mockReset().mockResolvedValue(undefined);
});

function as(user: { id: string; email: string; name: string } | null, isStaff = false) {
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user: { ...user, isStaff } } as never) : null);
}
const role = (key: Parameters<typeof systemRoleId>[1]) => systemRoleId(prisma, key);
const base = (o: string, e: string) => `http://localhost/api/org/${o}/events/${e}/members`;
const req = (method: string, url: string, body?: unknown) =>
  new NextRequest(url, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "content-type": "application/json" } });

async function setup() {
  const org = await makeOrg();
  const event = await makeEvent(org.id);
  const admin = await makeEventMember(event.id, "ADMIN");
  const ctx = { params: Promise.resolve({ orgId: org.id, eventId: event.id }) };
  const mctx = (membershipId: string) => ({ params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId } as never) });
  const url = base(org.id, event.id);
  const membershipOf = (userId: string) => prisma.eventMembership.findFirstOrThrow({ where: { userId, eventId: event.id }, include: { roleRef: true } });
  return { org, event, admin, ctx, mctx, url, membershipOf };
}

describe("GET /api/org/[orgId]/events/[eventId]/members", () => {
  it("401 sans session ; 403 pour OPERATOR ; ADMIN liste avec le rôle", async () => {
    const { event, admin, ctx, url } = await setup();
    const viewer = await makeEventMember(event.id, "VIEWER");
    as(null);
    expect((await GET(req("GET", url), ctx)).status).toBe(401);
    as(await makeEventMember(event.id, "OPERATOR"));
    expect((await GET(req("GET", url), ctx)).status).toBe(403);
    as(admin);
    const res = await GET(req("GET", url), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(3);
    const v = body.members.find((m: { user: { id: string } }) => m.user.id === viewer.id);
    expect(v.role).toMatchObject({ systemKey: "VIEWER", name: "Lecteur" });
  });

  it("un évènement archivé reste lisible ; une appartenance sans roleId est lue par son enum", async () => {
    const { event, admin, ctx, url } = await setup();
    const legacy = await makeUser();
    await prisma.eventMembership.create({ data: { userId: legacy.id, eventId: event.id, role: "OPERATOR" } });
    await prisma.event.update({ where: { id: event.id }, data: { archived: true, archivedAt: new Date() } });
    as(admin);
    const res = await GET(req("GET", url), ctx);
    expect(res.status).toBe(200);
    const m = (await res.json()).members.find((x: { user: { id: string } }) => x.user.id === legacy.id);
    expect(m.role).toMatchObject({ systemKey: "OPERATOR" });
  });
});

describe("POST /api/org/[orgId]/events/[eventId]/members", () => {
  it("401 ; 403 pour OPERATOR", async () => {
    const { event, ctx, url } = await setup();
    const body = { email: "z@test.fr", roleId: await role("VIEWER") };
    as(null);
    expect((await POST(req("POST", url, body), ctx)).status).toBe(401);
    as(await makeEventMember(event.id, "OPERATOR"));
    expect((await POST(req("POST", url, body), ctx)).status).toBe(403);
  });

  it("400 sur corps invalide, ancien champ role, JSON illisible ; 404 rôle inconnu ou d'une autre organisation ; 400 rôle d'une autre portée", async () => {
    const { admin, ctx, url } = await setup();
    as(admin);
    const post = (b: unknown) => POST(req("POST", url, b), ctx);
    expect((await post({ email: "z@test.fr", role: "VIEWER" })).status).toBe(400);
    expect((await post({ email: "pas-un-mail", roleId: "r" })).status).toBe(400);
    expect((await POST(new NextRequest(url, { method: "POST", body: "{x", headers: { "content-type": "application/json" } }), ctx)).status).toBe(400);
    const foreign = await makeCustomRole({ scope: "EVENT", orgId: (await makeOrg()).id, permissions: ["event.read"] });
    expect((await post({ email: "z@test.fr", roleId: "inconnu" })).status).toBe(404);
    expect((await post({ email: "z@test.fr", roleId: foreign.id })).status).toBe(404);
    expect((await post({ email: "z@test.fr", roleId: await role("MANAGER") })).status).toBe(400);
  });

  it("crée l'utilisateur et l'appartenance (roleId + enum), journalise et invite", async () => {
    const { event, admin, ctx, url, membershipOf } = await setup();
    as(admin);
    const res = await POST(req("POST", url, { email: "Nouveau@Test.fr", name: "Nouveau", roleId: await role("OPERATOR") }), ctx);
    expect(res.status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "nouveau@test.fr" } });
    expect(user.inviteToken).toMatch(/^[0-9a-f]{64}$/);
    const m = await membershipOf(user.id);
    expect(m.roleRef?.systemKey).toBe("OPERATOR");
    expect(m.role).toBe("OPERATOR");
    expect(sendUserInvitation).toHaveBeenCalledWith(user.id, expect.objectContaining({ eventId: event.id, role: "OPERATOR" }));
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "MEMBERSHIP_ADDED", targetId: user.id } });
    expect(log.details).toMatchObject({ role: "OPERATOR", scope: "event" });
  });

  it("nom absent : dérivé de l'email ; l'appartenance est créée même si l'invitation échoue", async () => {
    const { admin, ctx, url } = await setup();
    as(admin);
    vi.mocked(sendUserInvitation).mockRejectedValueOnce(new Error("smtp"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await POST(req("POST", url, { email: "sans.nom@test.fr", roleId: await role("VIEWER") }), ctx);
    spy.mockRestore();
    expect(res.status).toBe(201);
    expect((await prisma.user.findUniqueOrThrow({ where: { email: "sans.nom@test.fr" } })).name).toBe("sans.nom");
  });

  it("utilisateur existant : sans invitation ; déjà membre : 409 ALREADY_MEMBER", async () => {
    const { admin, ctx, url } = await setup();
    as(admin);
    const existing = await makeUser();
    const body = { email: existing.email, roleId: await role("VIEWER") };
    expect((await POST(req("POST", url, body), ctx)).status).toBe(201);
    expect(sendUserInvitation).not.toHaveBeenCalled();
    const dup = await POST(req("POST", url, body), ctx);
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe("ALREADY_MEMBER");
  });

  it("relance les erreurs inattendues de la base", async () => {
    const { admin, ctx, url } = await setup();
    as(admin);
    const spy = vi.spyOn(prisma.eventMembership, "create").mockRejectedValueOnce(Object.assign(new Error("db-boom"), { code: "P2003" }));
    await expect(POST(req("POST", url, { email: "boom@test.fr", roleId: await role("VIEWER") }), ctx)).rejects.toThrow("db-boom");
    spy.mockRestore();
  });

  it("anti-escalade : un rôle d'évènement personnalisé ne donne que ce qu'il détient ; un rôle personnalisé de l'organisation est attribuable", async () => {
    const { org, event, ctx, url, membershipOf } = await setup();
    const limited = await makeCustomRole({ scope: "EVENT", orgId: org.id, name: "Gère les membres", permissions: ["event.members.manage", "event.read"] });
    const actor = await makeUser();
    await prisma.eventMembership.create({ data: { userId: actor.id, eventId: event.id, roleId: limited.id } });
    as(actor);
    const denied = await POST(req("POST", url, { email: "a@test.fr", roleId: await role("ADMIN") }), ctx);
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toBe("PERMISSION_NOT_HELD");
    const small = await makeCustomRole({ scope: "EVENT", orgId: org.id, name: "Petit", permissions: ["event.read"] });
    expect((await POST(req("POST", url, { email: "b@test.fr", roleId: small.id }), ctx)).status).toBe(201);
    const created = await prisma.user.findUniqueOrThrow({ where: { email: "b@test.fr" } });
    const m = await membershipOf(created.id);
    expect(m.roleId).toBe(small.id);
    expect(m.role).toBeNull();
  });

  it("le staff (STAFF_ADMIN) peut attribuer un rôle système sans appartenance", async () => {
    const { ctx, url } = await setup();
    as(await makeStaff("STAFF_ADMIN"), true);
    expect((await POST(req("POST", url, { email: "s@test.fr", roleId: await role("ADMIN") }), ctx)).status).toBe(201);
  });
});

describe("PATCH /api/org/[orgId]/events/[eventId]/members/[membershipId]", () => {
  it("401 ; 403 pour OPERATOR ; 400 corps invalide ; 404 appartenance inconnue ou d'un autre évènement", async () => {
    const { org, event, admin, mctx, membershipOf, url } = await setup();
    const target = await makeEventMember(event.id, "VIEWER");
    const m = await membershipOf(target.id);
    const patch = (id: string, b: unknown) => PATCH(req("PATCH", `${url}/${id}`, b), mctx(id));
    as(null);
    expect((await patch(m.id, { roleId: await role("OPERATOR") })).status).toBe(401);
    as(await makeEventMember(event.id, "OPERATOR"));
    expect((await patch(m.id, { roleId: await role("OPERATOR") })).status).toBe(403);
    as(admin);
    expect((await patch(m.id, { role: "OPERATOR" })).status).toBe(400);
    expect((await PATCH(new NextRequest(`${url}/${m.id}`, { method: "PATCH", body: "{x" }), mctx(m.id))).status).toBe(400);
    expect((await patch("inconnu", { roleId: await role("OPERATOR") })).status).toBe(404);
    const otherEvent = await makeEvent(org.id);
    const stranger = await makeEventMember(otherEvent.id, "VIEWER");
    const foreign = await prisma.eventMembership.findFirstOrThrow({ where: { userId: stranger.id } });
    expect((await patch(foreign.id, { roleId: await role("OPERATOR") })).status).toBe(404);
  });

  it("change le rôle : double écriture et journal ; un rôle d'une autre organisation est refusé (404)", async () => {
    const { event, admin, mctx, membershipOf, url } = await setup();
    const target = await makeEventMember(event.id, "VIEWER");
    const m = await membershipOf(target.id);
    as(admin);
    const res = await PATCH(req("PATCH", `${url}/${m.id}`, { roleId: await role("OPERATOR") }), mctx(m.id));
    expect(res.status).toBe(200);
    expect((await res.json()).membership.role).toMatchObject({ systemKey: "OPERATOR" });
    const after = await membershipOf(target.id);
    expect(after.roleRef?.systemKey).toBe("OPERATOR");
    expect(after.role).toBe("OPERATOR");
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "MEMBERSHIP_ROLE_CHANGED", targetId: target.id } });
    expect(log.details).toMatchObject({ from: "VIEWER", to: "OPERATOR", scope: "event" });
    const foreign = await makeCustomRole({ scope: "EVENT", orgId: (await makeOrg()).id, permissions: ["event.read"] });
    expect((await PATCH(req("PATCH", `${url}/${m.id}`, { roleId: foreign.id }), mctx(m.id))).status).toBe(404);
  });

  it("une appartenance sans roleId (enum nul) passe à un rôle par roleId", async () => {
    const { event, admin, mctx, url } = await setup();
    const x = await makeUser();
    const m = await prisma.eventMembership.create({ data: { userId: x.id, eventId: event.id, role: null } });
    as(admin);
    const res = await PATCH(req("PATCH", `${url}/${m.id}`, { roleId: await role("OPERATOR") }), mctx(m.id));
    expect(res.status).toBe(200);
  });

  it("refuse la modification de son propre rôle (SELF_MODIFICATION)", async () => {
    const { admin, mctx, membershipOf, url } = await setup();
    const own = await membershipOf(admin.id);
    as(admin);
    const res = await PATCH(req("PATCH", `${url}/${own.id}`, { roleId: await role("VIEWER") }), mctx(own.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("SELF_MODIFICATION");
  });

  it("anti-escalade : refuse un rôle que l'acteur ne détient pas", async () => {
    const { org, event, mctx, membershipOf, url } = await setup();
    const limited = await makeCustomRole({ scope: "EVENT", orgId: org.id, permissions: ["event.members.manage", "event.read"] });
    const actor = await makeUser();
    await prisma.eventMembership.create({ data: { userId: actor.id, eventId: event.id, roleId: limited.id } });
    const target = await makeEventMember(event.id, "VIEWER");
    const m = await membershipOf(target.id);
    as(actor);
    const res = await PATCH(req("PATCH", `${url}/${m.id}`, { roleId: await role("ADMIN") }), mctx(m.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("PERMISSION_NOT_HELD");
  });
});

describe("DELETE /api/org/[orgId]/events/[eventId]/members/[membershipId]", () => {
  it("401 ; 403 pour OPERATOR ; 404 inconnue ; ADMIN retire (204) et journalise", async () => {
    const { event, admin, mctx, membershipOf, url } = await setup();
    const target = await makeEventMember(event.id, "OPERATOR");
    const m = await membershipOf(target.id);
    const del = (id: string) => DELETE(req("DELETE", `${url}/${id}`), mctx(id));
    as(null);
    expect((await del(m.id)).status).toBe(401);
    as(await makeEventMember(event.id, "OPERATOR"));
    expect((await del(m.id)).status).toBe(403);
    as(admin);
    expect((await del("inconnu")).status).toBe(404);
    expect((await del(m.id)).status).toBe(204);
    expect(await prisma.eventMembership.count({ where: { userId: target.id } })).toBe(0);
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "MEMBERSHIP_REMOVED", targetId: target.id } });
    expect(log).toMatchObject({ eventId: event.id });
    expect(log.details).toMatchObject({ role: "OPERATOR", scope: "event" });
  });
});
