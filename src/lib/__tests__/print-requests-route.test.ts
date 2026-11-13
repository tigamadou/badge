import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertNotStaff, organizerRoute } from "@/lib/print-requests/route";
import { PrintRequestError } from "@/lib/print-requests/errors";
import { makeStaff, makeOrgMember } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

describe("assertNotStaff", () => {
  it("lève STAFF_FORBIDDEN 403 pour un staff acteur, ne lève pas sinon", () => {
    expect(() => assertNotStaff({ isStaffActor: true })).toThrow(PrintRequestError);
    try {
      assertNotStaff({ isStaffActor: true });
    } catch (err) {
      expect(err).toMatchObject({ code: "STAFF_FORBIDDEN", status: 403 });
    }
    expect(() => assertNotStaff({ isStaffActor: false })).not.toThrow();
  });
});

describe("organizerRoute", () => {
  async function call(userId: string, method: string, orgId: string, eventId: string) {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
    const route = organizerRoute({ allowArchived: false }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${orgId}/events/${eventId}/print-requests/r1`, { method });
    return route(req, { params: Promise.resolve({ orgId, eventId, requestId: "r1" }) });
  }

  async function seed() {
    const org = await prisma.organization.create({ data: { name: "Org", slug: `org-${Date.now()}-${Math.random()}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Evt", slug: `evt-${Date.now()}-${Math.random()}`, location: "L", date: new Date() },
    });
    return { org, event };
  }

  it("staff non membre : GET passe, POST -> 403 STAFF_FORBIDDEN ; propriétaire de l'organisation : POST passe", async () => {
    const { org, event } = await seed();
    const sa = await makeStaff("SUPER_ADMIN");
    expect((await call(sa.id, "GET", org.id, event.id)).status).toBe(200);
    const denied = await call(sa.id, "POST", org.id, event.id);
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toBe("STAFF_FORBIDDEN");

    const owner = await makeOrgMember(org.id, "OWNER");
    expect((await call(owner.id, "POST", org.id, event.id)).status).toBe(200);
  });

  it("staff membre sans le droit côté organisateur : GET passe, POST -> 403 PERMISSION_DENIED ; avec le droit : POST passe", async () => {
    const { org, event } = await seed();
    const observer = await makeOrgMember(org.id, "AUDITOR", { isStaff: true, staffRole: "STAFF_OBSERVER" });
    expect((await call(observer.id, "GET", org.id, event.id)).status).toBe(200);
    const denied = await call(observer.id, "POST", org.id, event.id);
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toBe("PERMISSION_DENIED");

    const superAdmin = await makeOrgMember(org.id, "AGENT", { isStaff: true, staffRole: "SUPER_ADMIN" });
    expect((await call(superAdmin.id, "POST", org.id, event.id)).status).toBe(403);

    const manager = await makeOrgMember(org.id, "MANAGER", { isStaff: true, staffRole: "STAFF_OBSERVER" });
    expect((await call(manager.id, "POST", org.id, event.id)).status).toBe(200);
  });
});
