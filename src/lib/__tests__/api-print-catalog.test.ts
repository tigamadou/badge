import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCordonInDb } from "./helpers/print-products-db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const req = (url: string) => new NextRequest(`http://localhost${url}`, { method: "GET" });

async function asParticipant() {
  const u = await prisma.user.create({ data: { email: `${uniq("p")}@x`, password: "x", name: "P" } });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name },
  } as never);
}

describe("GET /api/print/catalog", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("401 sans session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { GET } = await import("@/app/api/print/catalog/route");
    const res = await GET(req("/api/print/catalog"));
    expect(res.status).toBe(401);
  });

  it("200 pour un participant connecte sans role", async () => {
    await asParticipant();
    const c = await createCordonInDb();
    const { GET } = await import("@/app/api/print/catalog/route");
    const res = await GET(req("/api/print/catalog"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const p = body.products.find((x: { id: string }) => x.id === c.productId);
    expect(p).toBeDefined();
    expect(p.images).toHaveLength(4);
    expect(p.priceTiers).toHaveLength(2);
  });

  it("filtre ?kind=BADGE exclut un accessoire", async () => {
    await asParticipant();
    const c = await createCordonInDb();
    const { GET } = await import("@/app/api/print/catalog/route");
    const body = await (await GET(req("/api/print/catalog?kind=BADGE"))).json();
    expect(body.products.map((x: { id: string }) => x.id)).not.toContain(c.productId);
  });

  it("400 VALIDATION pour kind=FOO", async () => {
    await asParticipant();
    const { GET } = await import("@/app/api/print/catalog/route");
    const res = await GET(req("/api/print/catalog?kind=FOO"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION");
  });

  it("archiver le cordon le retire de la reponse", async () => {
    await asParticipant();
    const c = await createCordonInDb();
    const { GET } = await import("@/app/api/print/catalog/route");
    let body = await (await GET(req("/api/print/catalog"))).json();
    expect(body.products.map((x: { id: string }) => x.id)).toContain(c.productId);
    await prisma.printProduct.update({ where: { id: c.productId }, data: { archived: true, archivedAt: new Date() } });
    body = await (await GET(req("/api/print/catalog"))).json();
    expect(body.products.map((x: { id: string }) => x.id)).not.toContain(c.productId);
  });
});
