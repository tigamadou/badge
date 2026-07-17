import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

afterAll(async () => {
  await prisma.activityLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.categoryTemplate.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function seedAdmin() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({
    data: { email: `a-${stamp}@x.test`, password: "x", name: "A" },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${stamp}`, location: "L", date: new Date() },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
  return { u, org, event };
}

async function cleanup() {
  await prisma.activityLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.categoryTemplate.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  vi.mocked(getServerSession).mockReset();
}

describe("POST /api/org/[orgId]/events/[eventId]/categories", () => {
  beforeEach(cleanup);

  it("creates a category and writes audit", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: "VIP", color: "#ff0000", number: 1, neutralBadge: false, anonymous: false }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);

    const cat = await prisma.category.findFirst({ where: { eventId: event.id } });
    expect(cat?.name).toBe("VIP");
    expect(cat?.number).toBe(1);

    const log = await prisma.activityLog.findFirst({ where: { type: "CATEGORY_CREATED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("refuses duplicate number within event (409)", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.category.create({ data: { eventId: event.id, name: "A", color: "#ffffff", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: "B", color: "#000000", number: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("NUMBER_TAKEN");
  });

  it("OPERATOR cannot POST categories (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({ data: { email: `op-${stamp}@x.test`, password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-op-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `evt-op-${stamp}`, location: "L", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: "X", color: "#ffffff", number: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/org/[orgId]/events/[eventId]/categories/[id]", () => {
  beforeEach(cleanup);

  it("refuses deletion when registrations linked (409 CATEGORY_HAS_REGISTRATIONS)", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "VIP", color: "#000000", number: 1 } });
    const p = await prisma.user.create({
      data: {
        email: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@x.test`,
        password: "x",
        name: "P",
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.registration.create({
      data: {
        id: "REG1",
        eventId: event.id,
        categoryId: cat.id,
        userId: p.id,
        snapshotEmail: "x@x.test",
        snapshotLastName: "L",
        snapshotFirstName: "F",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "D",
        snapshotIdDocument: "uploads/test/doc.pdf",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("CATEGORY_HAS_REGISTRATIONS");
    expect(json.count).toBe(1);
  });

  it("deletes empty category", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "VIP", color: "#000000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never),
    });
    expect(res.status).toBe(204);
    const after = await prisma.category.findUnique({ where: { id: cat.id } });
    expect(after).toBeNull();
  });
});

describe("POST /api/org/[orgId]/events/[eventId]/categories/import-templates", () => {
  beforeEach(cleanup);

  it("copies templates to categories, renumbering on collision", async () => {
    const { u, org, event } = await seedAdmin();
    const t1 = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "Délégué", color: "#ff0000", number: 1 },
    });
    const t2 = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "Invité", color: "#00ff00", number: 2 },
    });
    await prisma.category.create({ data: { eventId: event.id, name: "Existing", color: "#000000", number: 1 } });

    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/import-templates/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/import-templates`, {
      method: "POST",
      body: JSON.stringify({ templateIds: [t1.id, t2.id] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);

    const cats = await prisma.category.findMany({ where: { eventId: event.id }, orderBy: { number: "asc" } });
    expect(cats).toHaveLength(3);
    const numbers = cats.map((c) => c.number);
    expect(new Set(numbers).size).toBe(3);
  });

  it("refuses templates from another org", async () => {
    const { u, org, event } = await seedAdmin();
    const otherOrg = await prisma.organization.create({ data: { name: "Z", slug: `z-o-${Date.now()}` } });
    const t = await prisma.categoryTemplate.create({
      data: { orgId: otherOrg.id, name: "X", color: "#000000", number: 1 },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/import-templates/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/import-templates`, {
      method: "POST",
      body: JSON.stringify({ templateIds: [t.id] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
  });
});

describe("Category reassignment flow (critere d'acceptation #5)", () => {
  it("PATCH reassignToCategoryId moves registrations then DELETE succeeds", async () => {
    const { u, org, event } = await seedAdmin();
    const catFrom = await prisma.category.create({
      data: { eventId: event.id, name: "From", color: "#000000", number: 1 },
    });
    const catTo = await prisma.category.create({
      data: { eventId: event.id, name: "To", color: "#ffffff", number: 2 },
    });
    const pReassign = await prisma.user.create({
      data: {
        email: `reassign-${Date.now()}@journey.test`,
        password: "x",
        name: "P",
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.registration.create({
      data: {
        id: "R-REASSIGN-1",
        eventId: event.id,
        categoryId: catFrom.id,
        userId: pReassign.id,
        snapshotEmail: "reassign@journey.test",
        snapshotFirstName: "F",
        snapshotLastName: "L",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "D-REASSIGN-1",
        snapshotIdDocument: "uploads/test/doc.pdf",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    // 1. DELETE initial -> 409 (CATEGORY_HAS_REGISTRATIONS)
    const { DELETE } = await import(
      "@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route"
    );
    const r1 = await DELETE(
      new NextRequest(
        `http://localhost/api/org/${org.id}/events/${event.id}/categories/${catFrom.id}`,
        { method: "DELETE" },
      ),
      {
        params: Promise.resolve({ orgId: org.id, eventId: event.id, id: catFrom.id }),
      } as never,
    );
    expect(r1.status).toBe(409);

    // 2. PATCH reassignToCategoryId -> 200, deplace les inscriptions
    const { PATCH } = await import(
      "@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route"
    );
    const r2 = await PATCH(
      new NextRequest(
        `http://localhost/api/org/${org.id}/events/${event.id}/categories/${catFrom.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ reassignToCategoryId: catTo.id }),
          headers: { "content-type": "application/json" },
        },
      ),
      {
        params: Promise.resolve({ orgId: org.id, eventId: event.id, id: catFrom.id }),
      } as never,
    );
    expect(r2.status).toBe(200);

    // 3. DELETE -> 204
    const r3 = await DELETE(
      new NextRequest(
        `http://localhost/api/org/${org.id}/events/${event.id}/categories/${catFrom.id}`,
        { method: "DELETE" },
      ),
      {
        params: Promise.resolve({ orgId: org.id, eventId: event.id, id: catFrom.id }),
      } as never,
    );
    expect(r3.status).toBe(204);

    const remaining = await prisma.registration.findMany({ where: { eventId: event.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].categoryId).toBe(catTo.id);
  });
});
