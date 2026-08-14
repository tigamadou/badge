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

describe("GET /api/org/[orgId]/events/[eventId]/categories", () => {
  beforeEach(cleanup);

  it("lists categories with registration counts", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.category.create({ data: { eventId: event.id, name: "VIP", color: "#ff0000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories`, { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.categories).toHaveLength(1);
    expect(json.categories[0]).toMatchObject({ name: "VIP", number: 1, _count: { registrations: 0 } });
  });

  it("returns 401 without session", async () => {
    const { org, event } = await seedAdmin();
    vi.mocked(getServerSession).mockResolvedValue(null as never);

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories`, { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/org/[orgId]/events/[eventId]/categories", () => {
  beforeEach(cleanup);

  it("returns 400 VALIDATION on malformed JSON body", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION");
  });

  it("returns 400 on invalid body (missing color)", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: "VIP", number: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
  });

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

  it("refuses duplicate name within event (409 NAME_TAKEN)", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.category.create({ data: { eventId: event.id, name: "Shared", color: "#ffffff", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: "Shared", color: "#000000", number: 2 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("NAME_TAKEN");
  });

  it("returns 409 CONFLICT when the P2002 target matches neither number nor name", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const spy = vi
      .spyOn(prisma.category, "create")
      .mockRejectedValueOnce(Object.assign(new Error("p2002"), { code: "P2002", meta: { target: ["eventId"] } }));

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: "Generic", color: "#000000", number: 3 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("CONFLICT");
    spy.mockRestore();
  });

  it("returns 409 CONFLICT when the P2002 error carries no meta.target at all", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const spy = vi
      .spyOn(prisma.category, "create")
      .mockRejectedValueOnce(Object.assign(new Error("p2002"), { code: "P2002", meta: {} }));

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: "NoTarget", color: "#000000", number: 5 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("CONFLICT");
    spy.mockRestore();
  });

  it("rethrows non-P2002 errors from category creation", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const spy = vi
      .spyOn(prisma.category, "create")
      .mockRejectedValueOnce(Object.assign(new Error("db-boom"), { code: "P2003" }));

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: "Boom", color: "#000000", number: 4 }),
      headers: { "content-type": "application/json" },
    });
    await expect(POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) })).rejects.toThrow(
      "db-boom",
    );
    spy.mockRestore();
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

  it("returns 404 when the category does not exist in this event", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/does-not-exist`, { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: "does-not-exist" } as never),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/org/[orgId]/events/[eventId]/categories/[id]", () => {
  beforeEach(cleanup);

  it("returns 400 VALIDATION on malformed JSON body", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "VIP", color: "#000000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, {
      method: "PATCH",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid body (bad color)", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "VIP", color: "#000000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, {
      method: "PATCH",
      body: JSON.stringify({ color: "not-a-color" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the category does not exist in this event", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/does-not-exist`, {
      method: "PATCH",
      body: JSON.stringify({ name: "X" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: "does-not-exist" } as never),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 INVALID_TARGET when reassignToCategoryId points to another event", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "A", color: "#000000", number: 1 } });
    const otherStamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const otherOrg = await prisma.organization.create({ data: { name: "Z", slug: `z-${otherStamp}` } });
    const otherEvent = await prisma.event.create({
      data: { orgId: otherOrg.id, title: "Z", slug: `ze-${otherStamp}`, location: "L", date: new Date() },
    });
    const foreignCat = await prisma.category.create({
      data: { eventId: otherEvent.id, name: "Foreign", color: "#ffffff", number: 1 },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, {
      method: "PATCH",
      body: JSON.stringify({ reassignToCategoryId: foreignCat.id }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_TARGET");
  });

  it("returns 400 INVALID_TARGET when reassignToCategoryId does not exist", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "A", color: "#000000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, {
      method: "PATCH",
      body: JSON.stringify({ reassignToCategoryId: "does-not-exist" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_TARGET");
  });

  it("returns 400 INVALID_TARGET when reassignToCategoryId targets itself", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "A", color: "#000000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, {
      method: "PATCH",
      body: JSON.stringify({ reassignToCategoryId: cat.id }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_TARGET");
  });

  it("returns 400 NOTHING_TO_UPDATE on an empty body", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "VIP", color: "#000000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("NOTHING_TO_UPDATE");
  });

  it("returns 409 CONFLICT when patching to a name used by another category", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.category.create({ data: { eventId: event.id, name: "TakenName", color: "#000000", number: 1 } });
    const catB = await prisma.category.create({ data: { eventId: event.id, name: "B", color: "#ffffff", number: 2 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${catB.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "TakenName" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: catB.id } as never),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("CONFLICT");
  });

  it("rethrows non-P2002 errors from category update", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "Solo", color: "#000000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const spy = vi
      .spyOn(prisma.category, "update")
      .mockRejectedValueOnce(Object.assign(new Error("db-boom"), { code: "P2003" }));

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed" }),
      headers: { "content-type": "application/json" },
    });
    await expect(
      PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never) }),
    ).rejects.toThrow("db-boom");
    spy.mockRestore();
  });

  it("updates fields and writes CATEGORY_UPDATED audit", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "VIP", color: "#000000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "VIP Renamed" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.category.name).toBe("VIP Renamed");

    const log = await prisma.activityLog.findFirst({ where: { type: "CATEGORY_UPDATED" } });
    expect(log?.targetId).toBe(cat.id);
    expect((log?.details as { changedFields?: string[] } | null)?.changedFields).toEqual(["name"]);
  });

  it("returns 409 NUMBER_TAKEN when patching to a number used by another category", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.category.create({ data: { eventId: event.id, name: "A", color: "#000000", number: 1 } });
    const catB = await prisma.category.create({ data: { eventId: event.id, name: "B", color: "#ffffff", number: 2 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${catB.id}`, {
      method: "PATCH",
      body: JSON.stringify({ number: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: catB.id } as never),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("NUMBER_TAKEN");
  });

  it("returns 409 NUMBER_TAKEN when category.update fails with a P2002 array target containing number", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "Solo2", color: "#000000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const spy = vi
      .spyOn(prisma.category, "update")
      .mockRejectedValueOnce(Object.assign(new Error("p2002"), { code: "P2002", meta: { target: ["number"] } }));

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, {
      method: "PATCH",
      body: JSON.stringify({ number: 2 }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("NUMBER_TAKEN");
    spy.mockRestore();
  });

  it("returns 409 CONFLICT when category.update fails with a P2002 error carrying no meta.target", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "Solo3", color: "#000000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const spy = vi
      .spyOn(prisma.category, "update")
      .mockRejectedValueOnce(Object.assign(new Error("p2002"), { code: "P2002", meta: {} }));

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/${cat.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed3" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id } as never),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("CONFLICT");
    spy.mockRestore();
  });
});

describe("POST /api/org/[orgId]/events/[eventId]/categories/import-templates", () => {
  beforeEach(cleanup);

  it("returns 400 VALIDATION on malformed JSON body", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/import-templates/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/import-templates`, {
      method: "POST",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
  });

  it("increments the disambiguation counter past (2) when two collisions already exist", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.category.create({ data: { eventId: event.id, name: "Dup", color: "#000000", number: 90 } });
    await prisma.category.create({ data: { eventId: event.id, name: "Dup (2)", color: "#000000", number: 91 } });
    const t = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "Dup", color: "#ff0000", number: 92 },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/import-templates/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/import-templates`, {
      method: "POST",
      body: JSON.stringify({ templateIds: [t.id] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.categories).toHaveLength(1);
    expect(json.categories[0].name).toBe("Dup (3)");
  });

  it("returns 400 on invalid body (empty templateIds)", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/import-templates/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/import-templates`, {
      method: "POST",
      body: JSON.stringify({ templateIds: [] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
  });

  it("renumbers freely (no collision) but disambiguates a colliding name", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.category.create({ data: { eventId: event.id, name: "Dup", color: "#000000", number: 99 } });
    const t = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "Dup", color: "#ff0000", number: 10 },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/categories/import-templates/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/categories/import-templates`, {
      method: "POST",
      body: JSON.stringify({ templateIds: [t.id] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.categories).toHaveLength(1);
    expect(json.categories[0].number).toBe(10);
    expect(json.categories[0].name).toBe("Dup (2)");
  });

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
