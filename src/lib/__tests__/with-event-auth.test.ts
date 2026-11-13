import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeOrgMember } from "@/test/factories";
import { withEventAuth, type EventAuthCtx } from "@/lib/with-event-auth";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function setup() {
  const org = await prisma.organization.create({
    data: { name: "Org", slug: `org-${Date.now()}` },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Evt",
      slug: `evt-${Date.now()}`,
      location: "L",
      date: new Date(),
    },
  });
  return { org, event };
}

function mockSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

describe("withEventAuth", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    const { org, event } = await setup();
    vi.mocked(getServerSession).mockResolvedValue(null);
    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when eventId is missing from params", async () => {
    const { org } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: "" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Missing orgId or eventId");
  });

  it("returns 400 when orgId is missing from params", async () => {
    const { event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org//events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: "", eventId: event.id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when event does not exist", async () => {
    const { org } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/missing`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to a different org (URL tampering)", async () => {
    const { event } = await setup();
    const otherOrg = await prisma.organization.create({ data: { name: "Other", slug: "other" } });
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${otherOrg.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: otherOrg.id, eventId: event.id }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for user with no membership and not staff", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(403);
  });

  it("passes for OPERATOR membership when OPERATOR required", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "OPERATOR" },
    });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    let captured: { eventId: string; orgId: string; effectiveRole: string | null } | null = null;
    const handler = withEventAuth({ minRole: "OPERATOR" }, async (_req, ctx) => {
      captured = { eventId: ctx.eventId, orgId: ctx.orgId, effectiveRole: ctx.effectiveRole };
      return new Response("ok");
    });
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });

    expect(res.status).toBe(200);
    expect(captured).toEqual({ eventId: event.id, orgId: org.id, effectiveRole: "OPERATOR" });
  });

  it("rejects OPERATOR for ADMIN-required route (defense in depth)", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "OPERATOR" },
    });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "ADMIN" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(403);
  });

  it("OWNER of parent org inherits ADMIN on event", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "owner@x", password: "x", name: "O" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    let captured: string | null = null;
    const handler = withEventAuth({ minRole: "ADMIN" }, async (_req, ctx) => {
      captured = ctx.effectiveRole;
      return new Response("ok");
    });
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(200);
    expect(captured).toBe("ADMIN");
  });

  it("staff bypass", async () => {
    const { org, event } = await setup();
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    mockSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    let captured: string | null = null;
    const handler = withEventAuth({ minRole: "ADMIN" }, async (_req, ctx) => {
      captured = ctx.effectiveRole;
      return new Response("ok");
    });
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(200);
    expect(captured).toBe("STAFF");
  });

  it("leve une erreur si ni minRole ni permission ne sont fournis (mauvais usage)", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({}, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`);
    await expect(
      handler(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) }),
    ).rejects.toThrow("withEventAuth: minRole ou permission requis");
  });

  it("refuses archived event by default", async () => {
    const { org, event } = await setup();
    await prisma.event.update({ where: { id: event.id }, data: { archived: true } });
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "ADMIN" },
    });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.code).toBe("EVENT_ARCHIVED");
  });

  it("allowArchived=true lets archived events through", async () => {
    const { org, event } = await setup();
    await prisma.event.update({ where: { id: event.id }, data: { archived: true } });
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "ADMIN" },
    });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth(
      { minRole: "OPERATOR", allowArchived: true },
      async () => new Response("ok"),
    );
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(200);
  });

  it("requireRegistrationOpen=true blocks closed events", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "ADMIN" },
    });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth(
      { minRole: "ADMIN", requireRegistrationOpen: true },
      async () => new Response("ok"),
    );
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("REGISTRATION_CLOSED");
  });

  describe("garde d'abonnement (écritures)", () => {
    const DAY = 86_400_000;

    async function memberSetup(eventDate: Date) {
      const { org, event } = await setup();
      await prisma.event.update({ where: { id: event.id }, data: { date: eventDate } });
      const u = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
      await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
      mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
      return { org, event };
    }

    async function call(method: string, orgId: string, eventId: string) {
      const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
      const req = new NextRequest(`http://localhost/api/org/${orgId}/events/${eventId}`, { method });
      return handler(req, { params: Promise.resolve({ orgId, eventId }) });
    }

    // Aucun abonnement créé : l'organisation est inactive.
    it("POST + abonnement inactif + évènement en cours : handler appelé", async () => {
      const { org, event } = await memberSetup(new Date(Date.now() + DAY));
      expect((await call("POST", org.id, event.id)).status).toBe(200);
    });

    it("POST + abonnement inactif + évènement terminé : 403 SUBSCRIPTION_INACTIVE", async () => {
      const { org, event } = await memberSetup(new Date(Date.now() - 10 * DAY));
      const res = await call("POST", org.id, event.id);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "SUBSCRIPTION_INACTIVE", code: "SUBSCRIPTION_INACTIVE" });
    });

    it("GET + abonnement inactif + évènement terminé : handler appelé", async () => {
      const { org, event } = await memberSetup(new Date(Date.now() - 10 * DAY));
      expect((await call("GET", org.id, event.id)).status).toBe(200);
    });

    it("staff + abonnement inactif + évènement terminé : handler appelé", async () => {
      const { org, event } = await setup();
      await prisma.event.update({ where: { id: event.id }, data: { date: new Date(Date.now() - 10 * DAY) } });
      const s = await prisma.user.create({
        data: { email: "s2@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
      });
      mockSession({ id: s.id, email: s.email, name: s.name, isStaff: true });
      expect((await call("DELETE", org.id, event.id)).status).toBe(200);
    });
  });

  describe("option permission", () => {
    async function run(
      opts: Parameters<typeof withEventAuth>[0],
      user: { id: string; email: string; name: string },
      isStaff: boolean,
      ids: { orgId: string; eventId: string },
      capture?: (ctx: EventAuthCtx) => void,
    ) {
      mockSession({ id: user.id, email: user.email, name: user.name, isStaff });
      const handler = withEventAuth(opts, async (_req, ctx) => {
        capture?.(ctx);
        return new Response("ok");
      });
      return handler(new NextRequest(`http://localhost/api/org/${ids.orgId}/events/${ids.eventId}`), {
        params: Promise.resolve(ids),
      });
    }

    async function eventMember(role: "OPERATOR" | "VIEWER" | "ADMIN") {
      const { org, event } = await setup();
      const u = await prisma.user.create({ data: { email: `${role}@x`, password: "x", name: role } });
      await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role } });
      return { org, event, u, ids: { orgId: org.id, eventId: event.id } };
    }

    it("OPERATOR : 200 sur scan.check-in", async () => {
      const { u, ids } = await eventMember("OPERATOR");
      expect((await run({ permission: "scan.check-in" }, u, false, ids)).status).toBe(200);
    });

    it("VIEWER : 403 PERMISSION_DENIED", async () => {
      const { u, ids } = await eventMember("VIEWER");
      const res = await run({ permission: "scan.check-in" }, u, false, ids);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "PERMISSION_DENIED" });
    });

    it("AGENT de l'org : 200 sur scan.check-in", async () => {
      const { org, event } = await setup();
      const u = await makeOrgMember(org.id, "AGENT");
      expect((await run({ permission: "scan.check-in" }, u, false, { orgId: org.id, eventId: event.id })).status).toBe(200);
    });

    it("staff SUPER_ADMIN : 200, isStaffActor vrai, effectiveRole STAFF", async () => {
      const { org, event } = await setup();
      const s = await prisma.user.create({
        data: { email: "sa@x", password: "x", name: "S", isStaff: true, staffRole: "SUPER_ADMIN" },
      });
      let got: EventAuthCtx | null = null;
      const res = await run({ permission: "scan.check-in" }, s, true, { orgId: org.id, eventId: event.id }, (c) => (got = c));
      expect(res.status).toBe(200);
      const ctx = got as unknown as EventAuthCtx;
      expect(ctx.isStaffActor).toBe(true);
      expect(ctx.effectiveRole).toBe("STAFF");
      expect(ctx.permissions.has("scan.check-in")).toBe(true);
    });

    it("ctx : permissions effectives, event présent, isStaffActor faux pour un OWNER", async () => {
      const { org, event } = await setup();
      const u = await prisma.user.create({ data: { email: "ow@x", password: "x", name: "O" } });
      await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
      let got: EventAuthCtx | null = null;
      await run({ permission: "event.read.detailed" }, u, false, { orgId: org.id, eventId: event.id }, (c) => (got = c));
      const ctx = got as unknown as EventAuthCtx;
      expect(ctx.isStaffActor).toBe(false);
      expect(ctx.event).toMatchObject({ id: event.id, orgId: org.id, archived: false });
      expect(ctx.permissions.has("event.read.detailed")).toBe(true);
      expect(ctx.permissions.has("scan.check-in")).toBe(true);
      expect(ctx.effectiveRole).toBe("ADMIN");
    });

    it("liste : satisfaite par la seconde clé seulement", async () => {
      const { u, ids } = await eventMember("VIEWER");
      expect((await run({ permission: ["event.update", "event.read.aggregated"] }, u, false, ids)).status).toBe(200);
      const res = await run({ permission: ["event.update", "scan.check-in"] }, u, false, ids);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "PERMISSION_DENIED" });
    });

    it("compte archivé : 401 NOT_AUTHENTICATED", async () => {
      const { u, ids } = await eventMember("OPERATOR");
      await prisma.user.update({ where: { id: u.id }, data: { archived: true } });
      const res = await run({ permission: "scan.check-in" }, u, false, ids);
      expect(res.status).toBe(401);
    });

    it("minRole : ctx complet fourni aussi", async () => {
      const { u, ids } = await eventMember("OPERATOR");
      let got: EventAuthCtx | null = null;
      await run({ minRole: "OPERATOR" }, u, false, ids, (c) => (got = c));
      const ctx = got as unknown as EventAuthCtx;
      expect(ctx.effectiveRole).toBe("OPERATOR");
      expect(ctx.permissions.has("scan.check-in")).toBe(true);
    });

    it("minRole et permission ensemble : erreur de configuration", () => {
      expect(() =>
        withEventAuth({ minRole: "OPERATOR", permission: "scan.check-in" }, async () => new Response("ok")),
      ).toThrow("exclusifs");
    });

    it("permission d'un autre niveau : erreur de configuration", () => {
      expect(() => withEventAuth({ permission: "org.members.read" }, async () => new Response("ok"))).toThrow("EVENT");
    });
  });
});
