import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
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

function req(url: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
const idParams = (productId: string) => ({ params: Promise.resolve({ productId }) });
const base = (id: string, part: string) => `/api/platform/print/products/${id}/${part}`;
const key = () => `platform/print-products/${randomUUID()}.png`;

const routes = {
  images: { load: () => import("@/app/api/platform/print/products/[productId]/images/route"), part: "images", changed: ["images"],
    valid: () => ({ images: [{ storageKey: key(), alt: "a" }] }), invalid: { images: [{ storageKey: "orgs/x/images/a.jpg", alt: "" }] } },
  tiers: { load: () => import("@/app/api/platform/print/products/[productId]/tiers/route"), part: "tiers", changed: ["tiers"],
    valid: () => ({ tiers: [{ minQuantity: 100, unitPrice: 450 }] }), invalid: { tiers: [{ minQuantity: 1, unitPrice: 1 }] } },
  options: { load: () => import("@/app/api/platform/print/products/[productId]/options/route"), part: "options", changed: ["options"],
    valid: () => ({ options: [{ name: "Texte", help: null, type: "TEXT", required: false, priceDelta: 150, maxLength: 30, values: [] }] }),
    invalid: { options: [{ name: "Texte", help: null, type: "TEXT", required: false, priceDelta: 0, maxLength: null, values: [] }] } },
} as const;

describe.each(Object.entries(routes))("PUT …/%s", (_name, r) => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 sans session, 403 STAFF_OBSERVER", async () => {
    const { PUT } = await r.load();
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await PUT(req(base("x", r.part), r.valid()), idParams("x"))).status).toBe(401);
    await asStaff("STAFF_OBSERVER");
    expect((await PUT(req(base("x", r.part), r.valid()), idParams("x"))).status).toBe(403);
  });

  it("400 VALIDATION (corps invalide ou illisible)", async () => {
    await asStaff();
    const { PUT } = await r.load();
    const c = await createCordonInDb();
    const res = await PUT(req(base(c.productId, r.part), r.invalid), idParams(c.productId));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
    const raw = new NextRequest(`http://localhost${base(c.productId, r.part)}`, { method: "PUT", body: "{", headers: { "content-type": "application/json" } });
    expect((await PUT(raw, idParams(c.productId))).status).toBe(400);
  });

  it("404 inconnu, 409 archivé", async () => {
    await asStaff();
    const { PUT } = await r.load();
    const res404 = await PUT(req(base("inconnu", r.part), r.valid()), idParams("inconnu"));
    expect(res404.status).toBe(404);
    expect((await res404.json()).error).toBe("NOT_FOUND");
    const a = await createCordonInDb({ archived: true });
    const res409 = await PUT(req(base(a.productId, r.part), r.valid()), idParams(a.productId));
    expect(res409.status).toBe(409);
    expect((await res409.json()).error).toBe("PRODUCT_ARCHIVED");
  });

  it("200 + { product } + log PRINT_PRODUCT_UPDATED", async () => {
    const staff = await asStaff();
    const { PUT } = await r.load();
    const c = await createCordonInDb();
    const res = await PUT(req(base(c.productId, r.part), r.valid()), idParams(c.productId));
    expect(res.status).toBe(200);
    const { product } = await res.json();
    expect(product.id).toBe(c.productId);
    const log = await prisma.activityLog.findFirst({ where: { type: "PRINT_PRODUCT_UPDATED", targetId: c.productId } });
    expect(log?.userId).toBe(staff.id);
    expect(log?.details).toEqual({ changed: r.changed });
  });
});

describe("contenu renvoyé", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("reflète la nouvelle galerie, les paliers et les options", async () => {
    await asStaff();
    const c = await createCordonInDb();
    const images = routes.images.valid();
    const ri = await (await routes.images.load()).PUT(req(base(c.productId, "images"), images), idParams(c.productId));
    expect((await ri.json()).product.images).toEqual(images.images);
    const rt = await (await routes.tiers.load()).PUT(req(base(c.productId, "tiers"), routes.tiers.valid()), idParams(c.productId));
    expect((await rt.json()).product.priceTiers).toEqual([{ minQuantity: 100, unitPrice: 450 }]);
    const ro = await (await routes.options.load()).PUT(req(base(c.productId, "options"), routes.options.valid()), idParams(c.productId));
    const opts = (await ro.json()).product.options;
    expect(opts.map((o: { name: string }) => o.name)).toEqual(["Texte"]);
  });
});

describe("erreur inattendue", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it.each(Object.entries(routes))("PUT …/%s : une erreur non métier est relancée", async (_name, r) => {
    await asStaff();
    const { PUT } = await r.load();
    const c = await createCordonInDb();
    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("boom"));
    try {
      const out = await PUT(req(base(c.productId, r.part), r.valid()), idParams(c.productId)).then(
        (res) => res.status,
        () => "thrown",
      );
      expect(out === "thrown" || out === 500).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
