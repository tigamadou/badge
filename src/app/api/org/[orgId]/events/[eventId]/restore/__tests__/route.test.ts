import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeStaff } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}
function noSession() {
  vi.mocked(getServerSession).mockResolvedValue(null as never);
}

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// La route exige la permission `org.events.archive`.
async function seedArchivedEvent(orgRole: "OWNER" | "MANAGER" | "AUDITOR") {
  const s = stamp();
  const user = await prisma.user.create({
    data: { email: `res-${s}@x.test`, password: "x", name: "R" },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${s}` } });
  await prisma.orgMembership.create({ data: { userId: user.id, orgId: org.id, role: orgRole } });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Salon archive",
      slug: `evt-${s}`,
      location: "L",
      date: new Date("2026-10-01"),
      archived: true,
      archivedAt: new Date(),
    },
  });
  return { user, org, event };
}

describe("POST /api/org/[orgId]/events/[eventId]/restore", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rethrows a non-AuthError raised inside the permission guard (rethrow branch)", async () => {
    // requirePermission() delegue a loadUserContext() -> prisma.user.findUnique(). En faisant
    // echouer cet appel avec une erreur ordinaire (pas une AuthError), on force le `throw err`
    // de la l.22 (branche non couverte : err instanceof AuthError est false).
    const { user, org, event } = await seedArchivedEvent("MANAGER");
    withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });
    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("boom"));
    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/restore`, {
      method: "POST",
    });
    await expect(
      POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) }),
    ).rejects.toThrow("boom");
    spy.mockRestore();
  });

  it("returns 401 without session", async () => {
    const { org, event } = await seedArchivedEvent("MANAGER");
    noSession();
    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/restore`, {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for an AUDITOR (below MANAGER)", async () => {
    const { user, org, event } = await seedArchivedEvent("AUDITOR");
    withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });
    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/restore`, {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);

    const reloaded = await prisma.event.findUnique({ where: { id: event.id } });
    expect(reloaded?.archived).toBe(true);
  });

  it("returns 404 when the event does not belong to the org in the URL", async () => {
    // Le user doit avoir le role MANAGER sur `otherOrg` (l'orgId de l'URL) pour que
    // la garde par permission passe et que le test exerce bien la verification interne de la
    // route (event.orgId !== orgId), et non le 403 de la garde.
    const { user, event } = await seedArchivedEvent("MANAGER");
    const otherOrg = await prisma.organization.create({
      data: { name: "Other", slug: `other-${stamp()}` },
    });
    await prisma.orgMembership.create({
      data: { userId: user.id, orgId: otherOrg.id, role: "MANAGER" },
    });
    withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });
    const { POST } = await import("../route");
    const req = new NextRequest(
      `http://localhost/api/org/${otherOrg.id}/events/${event.id}/restore`,
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ orgId: otherOrg.id, eventId: event.id }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent eventId", async () => {
    const { user, org } = await seedArchivedEvent("MANAGER");
    withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });
    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/ghost-xyz/restore`, {
      method: "POST",
    });
    const res = await POST(req, {
      params: Promise.resolve({ orgId: org.id, eventId: "ghost-xyz" }),
    });
    expect(res.status).toBe(404);
  });

  it("MANAGER restores an archived event and logs EVENT_RESTORED", async () => {
    const { user, org, event } = await seedArchivedEvent("MANAGER");
    withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });
    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/restore`, {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const reloaded = await prisma.event.findUnique({ where: { id: event.id } });
    expect(reloaded?.archived).toBe(false);
    expect(reloaded?.archivedAt).toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "EVENT_RESTORED", eventId: event.id },
    });
    expect(log).not.toBeNull();
    expect(log?.orgId).toBe(org.id);
    expect(log?.userId).toBe(user.id);
    expect(log?.staffActor).toBe(false);
    const details = log?.details as { title: string };
    expect(details.title).toBe(event.title);
  });

  it("OWNER (satisfies MANAGER via hierarchy) restores the event", async () => {
    const { user, org, event } = await seedArchivedEvent("OWNER");
    withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });
    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/restore`, {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
  });

  it("platform staff bypasses org membership and logs staffActor=true", async () => {
    const s = stamp();
    const staff = await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-staff-${s}` } });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Salon staff",
        slug: `evt-staff-${s}`,
        location: "L",
        date: new Date("2026-10-01"),
        archived: true,
        archivedAt: new Date(),
      },
    });
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/restore`, {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);

    const log = await prisma.activityLog.findFirst({
      where: { type: "EVENT_RESTORED", eventId: event.id },
    });
    expect(log?.staffActor).toBe(true);
  });
});
