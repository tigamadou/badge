import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeStaff } from "@/test/factories";
import { makeBillingPlan } from "@/test/factories-billing";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { GET, POST } from "../route";
import { PATCH } from "../[planId]/route";

async function asStaff(role: "STAFF_ADMIN" | "STAFF_OBSERVER" = "STAFF_ADMIN") {
  const u = await makeStaff(role);
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: true } } as never);
  return u;
}

const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const post = (body: unknown) => POST(req("/api/platform/plans", "POST", body), { params: Promise.resolve({}) });
const patch = (id: string, body: unknown) =>
  PATCH(req(`/api/platform/plans/${id}`, "PATCH", body), { params: Promise.resolve({ planId: id }) });
const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

describe("plans : champs de la fiche publique", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("création avec tous les champs : 201, base et journal", async () => {
    const staff = await asStaff();
    const res = await post({
      name: uniq("pub"),
      price: 15000,
      publicVisible: true,
      position: 20,
      description: "  Pour les petites équipes  ",
      features: ["  10 événements ", "Support e-mail"],
      highlighted: true,
    });
    expect(res.status).toBe(201);
    const { plan } = await res.json();
    const row = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(row).toMatchObject({
      publicVisible: true,
      position: 20,
      description: "Pour les petites équipes",
      features: ["10 événements", "Support e-mail"],
      highlighted: true,
    });
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "PLAN_CREATED", targetId: plan.id } });
    expect(log.userId).toBe(staff.id);
    expect(log.details).toMatchObject({ publicVisible: true, position: 20, highlighted: true, features: ["10 événements", "Support e-mail"] });
  });

  it("valeurs par défaut", async () => {
    await asStaff();
    const { plan } = await (await post({ name: uniq("def") })).json();
    expect(await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).toMatchObject({
      publicVisible: false,
      position: 0,
      highlighted: false,
      features: null,
      description: null,
    });
  });

  it("validation : 13 fonctionnalités, élément vide, position négative ou trop grande, description trop longue", async () => {
    await asStaff();
    const bad = [
      { features: Array.from({ length: 13 }, (_, i) => `f${i}`) },
      { features: ["ok", "   "] },
      { features: ["x".repeat(121)] },
      { position: -1 },
      { position: 10000 },
      { description: "x".repeat(301) },
    ];
    for (const extra of bad) {
      const res = await post({ name: uniq("bad"), ...extra });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("VALIDATION");
    }
  });

  it("PATCH partiel : ne touche que le champ envoyé ; features null efface ; description vide devient null", async () => {
    await asStaff();
    const plan = await makeBillingPlan({
      publicVisible: true, position: 5, description: "d", features: ["a"], highlighted: true,
    });
    let res = await patch(plan.id, { position: 7 });
    expect(res.status).toBe(200);
    expect(await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).toMatchObject({
      publicVisible: true, position: 7, description: "d", features: ["a"], highlighted: true,
    });

    res = await patch(plan.id, { features: null, description: "   ", publicVisible: false, highlighted: false });
    expect(res.status).toBe(200);
    expect(await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).toMatchObject({
      publicVisible: false, position: 7, description: null, features: null, highlighted: false,
    });

    res = await patch(plan.id, { description: null, features: ["b", "c"] });
    expect(await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).toMatchObject({ description: null, features: ["b", "c"] });
  });

  it("PATCH : PLAN_UPDATED contient les nouveaux champs ; validation 400", async () => {
    await asStaff();
    const plan = await makeBillingPlan();
    await patch(plan.id, { publicVisible: true, position: 3, features: ["x"] });
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "PLAN_UPDATED", targetId: plan.id } });
    expect(log.details).toMatchObject({ publicVisible: true, position: 3, features: ["x"], highlighted: false });
    expect((await patch(plan.id, { features: Array.from({ length: 13 }, () => "f") })).status).toBe(400);
  });

  it("STAFF_OBSERVER → 403 sur création et modification", async () => {
    await asStaff("STAFF_OBSERVER");
    expect((await post({ name: uniq("obs") })).status).toBe(403);
    const plan = await makeBillingPlan();
    expect((await patch(plan.id, { position: 1 })).status).toBe(403);
  });

  it("GET renvoie les champs publics, triés par position puis création", async () => {
    await asStaff();
    const b = await makeBillingPlan({ position: 2, publicVisible: true, features: ["f"] });
    const a = await makeBillingPlan({ position: 1 });
    const c = await makeBillingPlan({ position: 2 });
    const res = await GET(req("/api/platform/plans", "GET"), { params: Promise.resolve({}) });
    const { plans } = (await res.json()) as { plans: { id: string; features: unknown; publicVisible: boolean }[] };
    const ids = plans.map((p) => p.id);
    expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id));
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(c.id));
    expect(plans.find((p) => p.id === b.id)).toMatchObject({ publicVisible: true, features: ["f"] });
  });
});
