import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { toLayoutSpec, layoutInputSchema } from "@/lib/print-sheets/layout-input";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function asStaff(role: "STAFF_ADMIN" | "STAFF_OBSERVER" = "STAFF_ADMIN") {
  const u = await prisma.user.create({
    data: { email: `staff-${role}-${Date.now()}-${Math.random()}@x`, password: "x", name: "S", isStaff: true, staffRole: role },
  });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: true },
  } as never);
  return u;
}

function req(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const noParams = { params: Promise.resolve({}) };
const idParams = (layoutId: string) => ({ params: Promise.resolve({ layoutId }) });

function valid(name: string) {
  return {
    name,
    sheetWidth: 2100,
    sheetHeight: 2970,
    sheetOrientation: "PORTRAIT",
    marginTop: 50,
    marginRight: 50,
    marginBottom: 50,
    marginLeft: 50,
    gapHorizontal: 20,
    gapVertical: 20,
    badgeOrientation: "AUTO",
    duplexFlip: "LONG_EDGE",
    cropMarks: true,
  };
}

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function create(name = uniq("lay")) {
  return prisma.printSheetLayout.create({ data: valid(name) as never });
}

describe("layout-input", () => {
  it("toLayoutSpec converts tenths of mm to mm", () => {
    const spec = toLayoutSpec({ ...valid("x"), sheetOrientation: "PORTRAIT", badgeOrientation: "AUTO", duplexFlip: "LONG_EDGE" });
    expect(spec.sheetWidthMm).toBe(210);
    expect(spec.sheetHeightMm).toBe(297);
    expect(spec.marginsMm).toEqual({ top: 5, right: 5, bottom: 5, left: 5 });
    expect(spec.gapHorizontalMm).toBe(2);
    expect(spec.cropMarks).toBe(true);
  });

  it("schema accepts width == height and rejects width > height", () => {
    expect(layoutInputSchema.safeParse({ ...valid("a"), sheetWidth: 2970 }).success).toBe(true);
    expect(layoutInputSchema.safeParse({ ...valid("a"), sheetWidth: 3000 }).success).toBe(false);
  });
});

describe("GET /api/platform/print/layouts", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { GET } = await import("@/app/api/platform/print/layouts/route");
    const res = await GET(req("/api/platform/print/layouts", "GET"), noParams);
    expect(res.status).toBe(401);
  });

  it("STAFF_OBSERVER lists active layouts by default and archived with ?archived=true", async () => {
    await asStaff("STAFF_OBSERVER");
    const active = await create();
    const archived = await prisma.printSheetLayout.create({
      data: { ...valid(uniq("arch")), archived: true, archivedAt: new Date() } as never,
    });
    const { GET } = await import("@/app/api/platform/print/layouts/route");
    const a = await (await GET(req("/api/platform/print/layouts", "GET"), noParams)).json();
    const ids = a.layouts.map((l: { id: string }) => l.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(archived.id);
    const b = await (await GET(req("/api/platform/print/layouts?archived=true", "GET"), noParams)).json();
    const idsB = b.layouts.map((l: { id: string }) => l.id);
    expect(idsB).toContain(archived.id);
    expect(idsB).not.toContain(active.id);
  });
});

describe("POST /api/platform/print/layouts", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { POST } = await import("@/app/api/platform/print/layouts/route");
    const res = await POST(req("/api/platform/print/layouts", "POST", valid(uniq("n"))), noParams);
    expect(res.status).toBe(401);
  });

  it("STAFF_OBSERVER gets 403", async () => {
    await asStaff("STAFF_OBSERVER");
    const { POST } = await import("@/app/api/platform/print/layouts/route");
    const res = await POST(req("/api/platform/print/layouts", "POST", valid(uniq("n"))), noParams);
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN creates (201) and logs PRINT_LAYOUT_CREATED", async () => {
    const staff = await asStaff();
    const { POST } = await import("@/app/api/platform/print/layouts/route");
    const res = await POST(req("/api/platform/print/layouts", "POST", valid(uniq("A4"))), noParams);
    expect(res.status).toBe(201);
    const { layout } = await res.json();
    expect(layout.createdById).toBe(staff.id);
    const log = await prisma.activityLog.findFirst({ where: { type: "PRINT_LAYOUT_CREATED", targetId: layout.id } });
    expect(log?.userId).toBe(staff.id);
  });

  it("400 VALIDATION: invalid JSON, width > height, negative margin, empty name", async () => {
    await asStaff();
    const { POST } = await import("@/app/api/platform/print/layouts/route");
    const bad = [
      { ...valid(uniq("n")), sheetWidth: 3000 },
      { ...valid(uniq("n")), marginTop: -1 },
      { ...valid("") },
      { ...valid("   ") },
    ];
    for (const body of bad) {
      const res = await POST(req("/api/platform/print/layouts", "POST", body), noParams);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("VALIDATION");
    }
    const raw = new NextRequest("http://localhost/api/platform/print/layouts", {
      method: "POST",
      body: "{nope",
      headers: { "content-type": "application/json" },
    });
    expect((await POST(raw, noParams)).status).toBe(400);
  });

  it("409 NAME_TAKEN on duplicate name", async () => {
    await asStaff();
    const name = uniq("dup");
    const { POST } = await import("@/app/api/platform/print/layouts/route");
    expect((await POST(req("/api/platform/print/layouts", "POST", valid(name)), noParams)).status).toBe(201);
    const res = await POST(req("/api/platform/print/layouts", "POST", valid(name)), noParams);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("NAME_TAKEN");
  });

  it("rethrows unexpected errors", async () => {
    await asStaff();
    const spy = vi.spyOn(prisma.printSheetLayout, "create").mockRejectedValueOnce(new Error("boom"));
    const { POST } = await import("@/app/api/platform/print/layouts/route");
    await expect(
      POST(req("/api/platform/print/layouts", "POST", valid(uniq("n"))), noParams),
    ).rejects.toThrow("boom");
    spy.mockRestore();
  });
});

describe("PATCH /api/platform/print/layouts/[layoutId]", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 without session, 403 for STAFF_OBSERVER", async () => {
    const { PATCH } = await import("@/app/api/platform/print/layouts/[layoutId]/route");
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await PATCH(req("/x", "PATCH", {}), idParams("x"))).status).toBe(401);
    await asStaff("STAFF_OBSERVER");
    expect((await PATCH(req("/x", "PATCH", {}), idParams("x"))).status).toBe(403);
  });

  it("updates, returns layout and logs PRINT_LAYOUT_UPDATED with changed fields", async () => {
    const staff = await asStaff();
    const l = await create();
    const { PATCH } = await import("@/app/api/platform/print/layouts/[layoutId]/route");
    const res = await PATCH(
      req("/x", "PATCH", { marginTop: 100, cropMarks: true, gapVertical: 30 }),
      idParams(l.id),
    );
    expect(res.status).toBe(200);
    const { layout } = await res.json();
    expect(layout.marginTop).toBe(100);
    const log = await prisma.activityLog.findFirst({ where: { type: "PRINT_LAYOUT_UPDATED", targetId: l.id } });
    expect(log?.userId).toBe(staff.id);
    expect((log?.details as { changed: string[] }).changed.sort()).toEqual(["gapVertical", "marginTop"]);
  });

  it("404 on unknown id", async () => {
    await asStaff();
    const { PATCH } = await import("@/app/api/platform/print/layouts/[layoutId]/route");
    expect((await PATCH(req("/x", "PATCH", { marginTop: 1 }), idParams("nope"))).status).toBe(404);
  });

  it("400 on invalid body and on merged width > height", async () => {
    await asStaff();
    const l = await create();
    const { PATCH } = await import("@/app/api/platform/print/layouts/[layoutId]/route");
    expect((await PATCH(req("/x", "PATCH", { marginTop: -5 }), idParams(l.id))).status).toBe(400);
    const raw = new NextRequest("http://localhost/x", {
      method: "PATCH",
      body: "{nope",
      headers: { "content-type": "application/json" },
    });
    expect((await PATCH(raw, idParams(l.id))).status).toBe(400);
    const res = await PATCH(req("/x", "PATCH", { sheetWidth: 3000 }), idParams(l.id));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
    const res2 = await PATCH(req("/x", "PATCH", { sheetHeight: 1000 }), idParams(l.id));
    expect(res2.status).toBe(400);
    const unchanged = await prisma.printSheetLayout.findUnique({ where: { id: l.id } });
    expect(unchanged?.sheetWidth).toBe(2100);
  });

  it("409 NAME_TAKEN when renaming to an existing name", async () => {
    await asStaff();
    const a = await create();
    const b = await create();
    const { PATCH } = await import("@/app/api/platform/print/layouts/[layoutId]/route");
    const res = await PATCH(req("/x", "PATCH", { name: a.name }), idParams(b.id));
    expect(res.status).toBe(409);
  });

  it("rethrows unexpected errors", async () => {
    await asStaff();
    const l = await create();
    const spy = vi.spyOn(prisma.printSheetLayout, "update").mockRejectedValueOnce(new Error("boom"));
    const { PATCH } = await import("@/app/api/platform/print/layouts/[layoutId]/route");
    await expect(PATCH(req("/x", "PATCH", { marginTop: 1 }), idParams(l.id))).rejects.toThrow("boom");
    spy.mockRestore();
  });
});

describe("DELETE /api/platform/print/layouts/[layoutId]", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 without session, 403 for STAFF_OBSERVER", async () => {
    const { DELETE } = await import("@/app/api/platform/print/layouts/[layoutId]/route");
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await DELETE(req("/x", "DELETE"), idParams("x"))).status).toBe(401);
    await asStaff("STAFF_OBSERVER");
    expect((await DELETE(req("/x", "DELETE"), idParams("x"))).status).toBe(403);
  });

  it("404 on unknown id", async () => {
    await asStaff();
    const { DELETE } = await import("@/app/api/platform/print/layouts/[layoutId]/route");
    expect((await DELETE(req("/x", "DELETE"), idParams("nope"))).status).toBe(404);
  });

  it("archives (no hard delete), logs, hides from archived=false, idempotent", async () => {
    const staff = await asStaff();
    const l = await create();
    const { DELETE } = await import("@/app/api/platform/print/layouts/[layoutId]/route");
    const res = await DELETE(req("/x", "DELETE"), idParams(l.id));
    expect(res.status).toBe(200);
    const { layout } = await res.json();
    expect(layout.archived).toBe(true);
    const row = await prisma.printSheetLayout.findUnique({ where: { id: l.id } });
    expect(row?.archived).toBe(true);
    expect(row?.archivedAt).not.toBeNull();
    const log = await prisma.activityLog.findFirst({ where: { type: "PRINT_LAYOUT_ARCHIVED", targetId: l.id } });
    expect(log?.userId).toBe(staff.id);

    const { GET } = await import("@/app/api/platform/print/layouts/route");
    const list = await (await GET(req("/api/platform/print/layouts", "GET"), noParams)).json();
    expect(list.layouts.map((x: { id: string }) => x.id)).not.toContain(l.id);

    const again = await DELETE(req("/x", "DELETE"), idParams(l.id));
    expect(again.status).toBe(200);
    const row2 = await prisma.printSheetLayout.findUnique({ where: { id: l.id } });
    expect(row2?.archivedAt?.getTime()).toBe(row?.archivedAt?.getTime());
    expect(await prisma.activityLog.count({ where: { type: "PRINT_LAYOUT_ARCHIVED", targetId: l.id } })).toBe(1);
  });
});
