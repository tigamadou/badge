import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/badge-templates/render-badge", () => ({
  resolveEventTemplate: vi.fn(async () => ({
    meta: { pages: 2, pageSize: { width: "324px", height: "204px" } },
  })),
}));
import { getServerSession } from "next-auth";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function asStaff(role: "STAFF_SUPPORT" | "STAFF_OBSERVER" = "STAFF_SUPPORT") {
  const u = await prisma.user.create({
    data: { email: `${uniq(role)}@x`, password: "x", name: "S", isStaff: true, staffRole: role },
  });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: true },
  } as never);
  return u;
}

function req(url: string, method: string, body?: unknown, raw?: string) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    headers: { "content-type": "application/json" },
  });
}
const noParams = { params: Promise.resolve({}) };
const idParams = (generationId: string) => ({ params: Promise.resolve({ generationId }) });

async function fixture() {
  const org = await prisma.organization.create({ data: { name: "O", slug: uniq("o") } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: uniq("e"), location: "L", date: new Date() },
  });
  const cat = await prisma.category.create({ data: { eventId: event.id, name: "A", color: "#000000", number: 1 } as never });
  const layout = await prisma.printSheetLayout.create({
    data: {
      name: uniq("lay"), sheetWidth: 2100, sheetHeight: 2970, sheetOrientation: "PORTRAIT",
      marginTop: 50, marginRight: 50, marginBottom: 50, marginLeft: 50,
      gapHorizontal: 20, gapVertical: 20, badgeOrientation: "AUTO", duplexFlip: "LONG_EDGE", cropMarks: true,
    },
  });
  const p = await prisma.user.create({ data: { email: `${uniq("p")}@x`, password: "x", name: "P" } });
  const r = await prisma.registration.create({
    data: {
      userId: p.id,
      id: uniq("REG"), eventId: event.id, categoryId: cat.id, status: "APPROVED",
      snapshotFirstName: "A", snapshotLastName: "B", snapshotEmail: `${uniq("r")}@x`, snapshotStructure: "S",
      snapshotPhoto: "", snapshotIdDocumentType: "CNI", snapshotIdDocumentNumber: "1", snapshotIdDocument: "",
    } as never,
  });
  return { event, layout, r };
}

describe("POST /api/platform/print/sheets", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { POST } = await import("@/app/api/platform/print/sheets/route");
    expect((await POST(req("/api/platform/print/sheets", "POST", {}), noParams)).status).toBe(401);
  });

  it("403 for STAFF_OBSERVER", async () => {
    await asStaff("STAFF_OBSERVER");
    const { POST } = await import("@/app/api/platform/print/sheets/route");
    expect((await POST(req("/api/platform/print/sheets", "POST", {}), noParams)).status).toBe(403);
  });

  it("201 creates and logs", async () => {
    const staff = await asStaff();
    const { event, layout } = await fixture();
    const { POST } = await import("@/app/api/platform/print/sheets/route");
    const res = await POST(
      req("/api/platform/print/sheets", "POST", {
        eventId: event.id, layoutId: layout.id, selection: { mode: "ALL" }, duplex: true,
      }),
      noParams,
    );
    expect(res.status).toBe(201);
    const { generation } = await res.json();
    expect(generation.createdById).toBe(staff.id);
    expect(generation.badgeCount).toBe(1);
    const logs = await prisma.activityLog.findMany({ where: { type: "PRINT_SHEETS_GENERATED", targetId: generation.id } });
    expect(logs).toHaveLength(1);
  });

  it("transmet printRequestId et lie la generation a la demande", async () => {
    await asStaff();
    const { event, layout, r } = await fixture();
    const owner = await prisma.user.create({ data: { email: `${uniq("ow")}@x`, password: "x", name: "O" } });
    const request = await prisma.printRequest.create({
      data: { reference: uniq("PR-A"), eventId: event.id, orgId: event.orgId, type: "ADVANCE", status: "PAID", createdById: owner.id },
    });
    await prisma.printRequestItem.create({ data: { requestId: request.id, registrationId: r.id, position: 0 } });
    const { POST } = await import("@/app/api/platform/print/sheets/route");
    const res = await POST(
      req("/api/platform/print/sheets", "POST", {
        eventId: event.id, layoutId: layout.id, printRequestId: request.id,
        selection: { mode: "IDS", registrationIds: [r.id] }, duplex: false,
      }),
      noParams,
    );
    expect(res.status).toBe(201);
    const { generation } = await res.json();
    expect(generation.printRequestId).toBe(request.id);
    expect(generation.duplex).toBe(true);
    const all = await POST(
      req("/api/platform/print/sheets", "POST", {
        eventId: event.id, layoutId: layout.id, printRequestId: request.id, selection: { mode: "REQUEST" },
      }),
      noParams,
    );
    expect(all.status).toBe(201);
    expect((await all.json()).generation.registrationIds).toEqual([r.id]);
    const bad = await POST(
      req("/api/platform/print/sheets", "POST", {
        eventId: event.id, layoutId: layout.id, printRequestId: "nope", selection: { mode: "ALL" },
      }),
      noParams,
    );
    expect(bad.status).toBe(404);
  });

  it("duplex defaults to false", async () => {
    await asStaff();
    const { event, layout } = await fixture();
    const { POST } = await import("@/app/api/platform/print/sheets/route");
    const res = await POST(
      req("/api/platform/print/sheets", "POST", { eventId: event.id, layoutId: layout.id, selection: { mode: "ALL" } }),
      noParams,
    );
    expect(res.status).toBe(201);
    expect((await res.json()).generation.duplex).toBe(false);
  });

  it("400 VALIDATION on invalid body", async () => {
    await asStaff();
    const { POST } = await import("@/app/api/platform/print/sheets/route");
    const bodies = [
      { eventId: "e", layoutId: "l", selection: { mode: "NOPE" } },
      { eventId: "", layoutId: "l", selection: { mode: "ALL" } },
      { eventId: "e", layoutId: "l", selection: { mode: "CATEGORIES" } },
    ];
    for (const b of bodies) {
      const res = await POST(req("/api/platform/print/sheets", "POST", b), noParams);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("VALIDATION");
    }
    const res = await POST(req("/api/platform/print/sheets", "POST", undefined, "{nope"), noParams);
    expect(res.status).toBe(400);
  });

  it("400 VALIDATION when the IDS list exceeds 5000", async () => {
    await asStaff();
    const { POST } = await import("@/app/api/platform/print/sheets/route");
    const registrationIds = Array.from({ length: 5001 }, (_, i) => `r${i}`);
    const res = await POST(
      req("/api/platform/print/sheets", "POST", {
        eventId: "e", layoutId: "l", selection: { mode: "IDS", registrationIds },
      }),
      noParams,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
  });

  it("translates GenerationError to its status and code", async () => {
    await asStaff();
    const { event } = await fixture();
    const { POST } = await import("@/app/api/platform/print/sheets/route");
    const res = await POST(
      req("/api/platform/print/sheets", "POST", { eventId: event.id, layoutId: "nope", selection: { mode: "ALL" } }),
      noParams,
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("LAYOUT_NOT_FOUND");
  });

  it("rethrows unexpected errors", async () => {
    vi.resetModules();
    vi.doMock("@/lib/print-sheets/generations", async (orig) => ({
      ...(await orig<typeof import("@/lib/print-sheets/generations")>()),
      createGeneration: vi.fn().mockRejectedValue(new Error("boom")),
    }));
    await asStaff();
    const { POST } = await import("@/app/api/platform/print/sheets/route");
    await expect(
      POST(req("/api/platform/print/sheets", "POST", { eventId: "e", layoutId: "l", selection: { mode: "ALL" } }), noParams),
    ).rejects.toThrow("boom");
    vi.doUnmock("@/lib/print-sheets/generations");
    vi.resetModules();
  });
});

describe("GET /api/platform/print/sheets", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 without session, 403 for STAFF_OBSERVER (SUPPORT minimum)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { GET } = await import("@/app/api/platform/print/sheets/route");
    expect((await GET(req("/api/platform/print/sheets", "GET"), noParams)).status).toBe(401);
    await asStaff("STAFF_OBSERVER");
    expect((await GET(req("/api/platform/print/sheets", "GET"), noParams)).status).toBe(403);
  });

  it("lists the 50 latest with event, layout and author, filtered by eventId", async () => {
    const staff = await asStaff();
    const { event, layout } = await fixture();
    const other = await fixture();
    const base = { eventId: event.id, layoutId: layout.id, registrationIds: [], createdById: staff.id };
    await prisma.printSheetGeneration.createMany({
      data: Array.from({ length: 52 }, (_, i) => ({ ...base, createdAt: new Date(2026, 0, 1, 0, 0, i) })),
    });
    await prisma.printSheetGeneration.create({ data: { eventId: other.event.id, registrationIds: [] } });
    const { GET } = await import("@/app/api/platform/print/sheets/route");
    const res = await GET(req(`/api/platform/print/sheets?eventId=${event.id}`, "GET"), noParams);
    const { generations } = await res.json();
    expect(generations).toHaveLength(50);
    expect(generations[0].createdAt > generations[49].createdAt).toBe(true);
    expect(generations[0].event.id).toBe(event.id);
    expect(generations[0].layout.id).toBe(layout.id);
    expect(generations[0].createdBy.id).toBe(staff.id);
    const all = await (await GET(req("/api/platform/print/sheets", "GET"), noParams)).json();
    expect(all.generations.some((g: { eventId: string }) => g.eventId === other.event.id)).toBe(true);
  });
});

describe("GET /api/platform/print/sheets (liste de l'ecran)", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("returns only SHEETS rows and never the registrationIds", async () => {
    const staff = await asStaff();
    const { event, layout } = await fixture();
    const base = { eventId: event.id, layoutId: layout.id, createdById: staff.id, registrationIds: ["a", "b"] };
    const sheets = await prisma.printSheetGeneration.create({ data: { ...base, output: "SHEETS" } });
    const zip = await prisma.printSheetGeneration.create({ data: { ...base, output: "ZIP" } });
    const { GET } = await import("@/app/api/platform/print/sheets/route");
    const { generations } = await (
      await GET(req(`/api/platform/print/sheets?eventId=${event.id}`, "GET"), noParams)
    ).json();
    const ids = generations.map((g: { id: string }) => g.id);
    expect(ids).toContain(sheets.id);
    expect(ids).not.toContain(zip.id);
    expect(generations[0]).not.toHaveProperty("registrationIds");
    expect(generations[0]).not.toHaveProperty("layoutSnapshot");
  });
});

describe("GET /api/platform/print/sheets/[generationId]", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401, 403, 404 and 200", async () => {
    const { GET } = await import("@/app/api/platform/print/sheets/[generationId]/route");
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await GET(req("/x", "GET"), idParams("g"))).status).toBe(401);
    await asStaff("STAFF_OBSERVER");
    expect((await GET(req("/x", "GET"), idParams("g"))).status).toBe(403);
    await asStaff();
    expect((await GET(req("/x", "GET"), idParams("ghost"))).status).toBe(404);
    const { event } = await fixture();
    const g = await prisma.printSheetGeneration.create({ data: { eventId: event.id, registrationIds: [] } });
    const res = await GET(req("/x", "GET"), idParams(g.id));
    expect(res.status).toBe(200);
    const body = (await res.json()).generation;
    expect(body.id).toBe(g.id);
    expect(body.status).toBe("PENDING");
    expect(body).not.toHaveProperty("registrationIds");
    expect(body).not.toHaveProperty("lockedBy");
  });
});
