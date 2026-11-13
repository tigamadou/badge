import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { pxToMm } from "@/lib/print-sheets/units";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
const template = vi.hoisted(() => ({ pages: 2 }));
vi.mock("@/lib/badge-templates/render-badge", () => ({
  resolveEventTemplate: vi.fn(async () => ({
    meta: { pages: template.pages, pageSize: { width: "324px", height: "204px" } },
  })),
}));
import { getServerSession } from "next-auth";
import { makeStaff } from "@/test/factories";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function asStaff(role: "STAFF_PRINTER" | "STAFF_SUPPORT" | "STAFF_OBSERVER" = "STAFF_PRINTER") {
  const u = await makeStaff(role);
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: true },
  } as never);
}

const noParams = { params: Promise.resolve({}) };
const req = (url: string) => new NextRequest(`http://localhost${url}`, { method: "GET" });

async function registration(eventId: string, categoryId: string, status: "APPROVED" | "PENDING" | "REJECTED", last: string) {
  const p = await prisma.user.create({ data: { email: `${uniq("p")}@x`, password: "x", name: "P" } });
  return prisma.registration.create({
    data: {
      userId: p.id, id: uniq("REG"), eventId, categoryId, status,
      snapshotFirstName: "Ada", snapshotLastName: last, snapshotEmail: `${uniq("r")}@x`, snapshotStructure: "S",
      snapshotPhoto: "", snapshotIdDocumentType: "CNI", snapshotIdDocumentNumber: "1", snapshotIdDocument: "",
    } as never,
  });
}

async function fixture() {
  const org = await prisma.organization.create({ data: { name: uniq("Org"), slug: uniq("o") } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: uniq("e"), location: "L", date: new Date() },
  });
  const cat = await prisma.category.create({ data: { eventId: event.id, name: "VIP", color: "#000000", number: 1 } as never });
  const empty = await prisma.category.create({ data: { eventId: event.id, name: "Vide", color: "#000000", number: 2 } as never });
  const ok = await registration(event.id, cat.id, "APPROVED", "Zed");
  await registration(event.id, cat.id, "PENDING", "Pending");
  await registration(event.id, cat.id, "REJECTED", "Rejected");
  return { org, event, cat, empty, ok };
}

describe("GET /api/platform/print/sheets/options", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    template.pages = 2;
  });

  it("401 without session, 403 for STAFF_OBSERVER and STAFF_SUPPORT", async () => {
    const { GET } = await import("@/app/api/platform/print/sheets/options/route");
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await GET(req("/api/platform/print/sheets/options"), noParams)).status).toBe(401);
    await asStaff("STAFF_OBSERVER");
    expect((await GET(req("/api/platform/print/sheets/options"), noParams)).status).toBe(403);
    await asStaff("STAFF_SUPPORT");
    expect((await GET(req("/api/platform/print/sheets/options"), noParams)).status).toBe(403);
  });

  it("lists organizations, events and categories with approved counts only", async () => {
    await asStaff();
    const { org, event, cat, empty } = await fixture();
    const { GET } = await import("@/app/api/platform/print/sheets/options/route");
    const res = await GET(req("/api/platform/print/sheets/options"), noParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    const o = body.organizations.find((x: { id: string }) => x.id === org.id);
    const e = o.events.find((x: { id: string }) => x.id === event.id);
    expect(e.approvedCount).toBe(1);
    expect(e.categories.find((c: { id: string }) => c.id === cat.id).approvedCount).toBe(1);
    expect(e.categories.find((c: { id: string }) => c.id === empty.id).approvedCount).toBe(0);
    expect(body.event).toBeUndefined();
  });

  it("an event without any approved registration reports approvedCount 0", async () => {
    await asStaff();
    const org = await prisma.organization.create({ data: { name: uniq("Org"), slug: uniq("o") } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Vide", slug: uniq("e"), location: "L", date: new Date() },
    });
    const { GET } = await import("@/app/api/platform/print/sheets/options/route");
    const body = await (await GET(req("/api/platform/print/sheets/options"), noParams)).json();
    const e = body.organizations.find((x: { id: string }) => x.id === org.id).events.find((x: { id: string }) => x.id === event.id);
    expect(e.approvedCount).toBe(0);
  });

  it("with eventId returns the effective badge format in mm, page count and approved registrations only", async () => {
    await asStaff();
    const { event, cat, ok } = await fixture();
    const { GET } = await import("@/app/api/platform/print/sheets/options/route");
    const res = await GET(req(`/api/platform/print/sheets/options?eventId=${event.id}`), noParams);
    expect(res.status).toBe(200);
    const { event: detail } = await res.json();
    expect(detail.id).toBe(event.id);
    expect(detail.badgePages).toBe(2);
    expect(detail.badgeMm.width).toBeCloseTo(pxToMm(324));
    expect(detail.badgeMm.height).toBeCloseTo(pxToMm(204));
    expect(detail.registrations).toEqual([
      { id: ok.id, firstName: "Ada", lastName: "Zed", categoryId: cat.id },
    ]);
  });

  it("reports badgePages 1 for a single-page template", async () => {
    await asStaff();
    const { event } = await fixture();
    template.pages = 1;
    const { GET } = await import("@/app/api/platform/print/sheets/options/route");
    const { event: detail } = await (await GET(req(`/api/platform/print/sheets/options?eventId=${event.id}`), noParams)).json();
    expect(detail.badgePages).toBe(1);
  });

  it("returns total and truncated when the list is capped", async () => {
    await asStaff();
    const { event, cat } = await fixture();
    await registration(event.id, cat.id, "APPROVED", "Second");
    await registration(event.id, cat.id, "APPROVED", "Third");
    const { GET, OPTIONS_LIMITS } = await import("@/app/api/platform/print/sheets/options/route");
    const get = async () =>
      (await (await GET(req(`/api/platform/print/sheets/options?eventId=${event.id}`), noParams)).json()).event;
    const full = await get();
    expect(full.total).toBe(3);
    expect(full.truncated).toBe(false);
    OPTIONS_LIMITS.maxRegistrations = 2;
    try {
      const capped = await get();
      expect(capped.total).toBe(3);
      expect(capped.truncated).toBe(true);
      expect(capped.registrations).toHaveLength(2);
    } finally {
      OPTIONS_LIMITS.maxRegistrations = 5000;
    }
  });

  it("404 for an unknown eventId", async () => {
    await asStaff();
    const { GET } = await import("@/app/api/platform/print/sheets/options/route");
    const res = await GET(req("/api/platform/print/sheets/options?eventId=nope"), noParams);
    expect(res.status).toBe(404);
  });
});
