import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCordonInDb } from "./helpers/print-products-db";

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
const idParams = (productId: string) => ({ params: Promise.resolve({ productId }) });
const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const LIST = "/api/platform/print/products";
const validBody = () => ({ kind: "ACCESSORY", name: uniq("Cordon"), basePrice: 500 });

const loadRoutes = async () => ({
  list: await import("@/app/api/platform/print/products/route"),
  one: await import("@/app/api/platform/print/products/[productId]/route"),
});

describe("POST /api/platform/print/products", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 sans session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { list } = await loadRoutes();
    expect((await list.POST(req(LIST, "POST", validBody()), noParams)).status).toBe(401);
  });

  it("403 pour STAFF_OBSERVER", async () => {
    await asStaff("STAFF_OBSERVER");
    const { list } = await loadRoutes();
    expect((await list.POST(req(LIST, "POST", validBody()), noParams)).status).toBe(403);
  });

  it("201 + log PRINT_PRODUCT_CREATED", async () => {
    const staff = await asStaff();
    const { list } = await loadRoutes();
    const body = validBody();
    const res = await list.POST(req(LIST, "POST", body), noParams);
    expect(res.status).toBe(201);
    const { product } = await res.json();
    expect(product).toMatchObject({ published: false, minQuantity: 1, createdById: staff.id });
    const log = await prisma.activityLog.findFirst({ where: { type: "PRINT_PRODUCT_CREATED", targetId: product.id } });
    expect(log?.userId).toBe(staff.id);
    expect(log?.details).toEqual({ name: body.name, kind: "ACCESSORY" });
  });

  it("400 VALIDATION", async () => {
    await asStaff();
    const { list } = await loadRoutes();
    const bad = [
      { ...validBody(), name: "" },
      { ...validBody(), name: "   " },
      { ...validBody(), basePrice: -1 },
      { ...validBody(), minQuantity: 0 },
      { name: uniq("n"), basePrice: 5 },
    ];
    for (const body of bad) {
      const res = await list.POST(req(LIST, "POST", body), noParams);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("VALIDATION");
    }
    const raw = new NextRequest(`http://localhost${LIST}`, { method: "POST", body: "{", headers: { "content-type": "application/json" } });
    expect((await list.POST(raw, noParams)).status).toBe(400);
  });
});

describe("GET /api/platform/print/products", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("STAFF_OBSERVER liste ; filtres kind et archived", async () => {
    await asStaff("STAFF_OBSERVER");
    const c = await createCordonInDb();
    const arch = await createCordonInDb({ archived: true });
    const { list } = await loadRoutes();
    const a = await (await list.GET(req(`${LIST}?kind=ACCESSORY`, "GET"), noParams)).json();
    const ids = a.products.map((p: { id: string }) => p.id);
    expect(ids).toContain(c.productId);
    expect(ids).not.toContain(arch.productId);
    const b = await (await list.GET(req(`${LIST}?archived=true`, "GET"), noParams)).json();
    expect(b.products.map((p: { id: string }) => p.id)).toContain(arch.productId);
    const bad = await list.GET(req(`${LIST}?kind=NOPE`, "GET"), noParams);
    expect(bad.status).toBe(400);
  });

  it("401 sans session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { list } = await loadRoutes();
    expect((await list.GET(req(LIST, "GET"), noParams)).status).toBe(401);
  });
});

describe("PATCH /api/platform/print/products/[productId]", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 / 403", async () => {
    const { one } = await loadRoutes();
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await one.PATCH(req(`${LIST}/x`, "PATCH", {}), idParams("x"))).status).toBe(401);
    await asStaff("STAFF_OBSERVER");
    expect((await one.PATCH(req(`${LIST}/x`, "PATCH", { basePrice: 1 }), idParams("x"))).status).toBe(403);
  });

  it("404 inconnu, 400 invalide, 409 archivé", async () => {
    await asStaff();
    const { one } = await loadRoutes();
    const res404 = await one.PATCH(req(`${LIST}/x`, "PATCH", { basePrice: 1 }), idParams("inconnu"));
    expect(res404.status).toBe(404);
    expect((await res404.json()).error).toBe("NOT_FOUND");
    const c = await createCordonInDb();
    const res400 = await one.PATCH(req(`${LIST}/${c.productId}`, "PATCH", { basePrice: -5 }), idParams(c.productId));
    expect(res400.status).toBe(400);
    const a = await createCordonInDb({ archived: true });
    const res409 = await one.PATCH(req(`${LIST}/${a.productId}`, "PATCH", { basePrice: 5 }), idParams(a.productId));
    expect(res409.status).toBe(409);
    expect((await res409.json()).error).toBe("PRODUCT_ARCHIVED");
  });

  it("publier conserve minQuantity (50) et logue changed: [published]", async () => {
    const staff = await asStaff();
    const { one } = await loadRoutes();
    const c = await createCordonInDb({ published: false });
    const res = await one.PATCH(req(`${LIST}/${c.productId}`, "PATCH", { published: true }), idParams(c.productId));
    expect(res.status).toBe(200);
    const { product } = await res.json();
    expect(product).toMatchObject({ published: true, minQuantity: 50 });
    const log = await prisma.activityLog.findFirst({ where: { type: "PRINT_PRODUCT_UPDATED", targetId: c.productId } });
    expect(log?.userId).toBe(staff.id);
    expect(log?.details).toEqual({ changed: ["published"] });
  });

  it("aucun log si rien ne change", async () => {
    await asStaff();
    const { one } = await loadRoutes();
    const c = await createCordonInDb();
    const res = await one.PATCH(req(`${LIST}/${c.productId}`, "PATCH", { basePrice: 500 }), idParams(c.productId));
    expect(res.status).toBe(200);
    expect(await prisma.activityLog.count({ where: { type: "PRINT_PRODUCT_UPDATED", targetId: c.productId } })).toBe(0);
  });
});

describe("DELETE /api/platform/print/products/[productId]", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 / 403", async () => {
    const { one } = await loadRoutes();
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await one.DELETE(req(`${LIST}/x`, "DELETE"), idParams("x"))).status).toBe(401);
    await asStaff("STAFF_OBSERVER");
    expect((await one.DELETE(req(`${LIST}/x`, "DELETE"), idParams("x"))).status).toBe(403);
  });

  it("archive, dépublie, logue ; 409 en répétition ; 404 inconnu", async () => {
    const staff = await asStaff();
    const { one } = await loadRoutes();
    const c = await createCordonInDb();
    const res = await one.DELETE(req(`${LIST}/${c.productId}`, "DELETE"), idParams(c.productId));
    expect(res.status).toBe(200);
    const { product } = await res.json();
    expect(product).toMatchObject({ archived: true, published: false });
    const log = await prisma.activityLog.findFirst({ where: { type: "PRINT_PRODUCT_ARCHIVED", targetId: c.productId } });
    expect(log?.userId).toBe(staff.id);
    const again = await one.DELETE(req(`${LIST}/${c.productId}`, "DELETE"), idParams(c.productId));
    expect(again.status).toBe(409);
    expect((await again.json()).error).toBe("PRODUCT_ARCHIVED");
    expect((await one.DELETE(req(`${LIST}/x`, "DELETE"), idParams("inconnu"))).status).toBe(404);
  });
});
