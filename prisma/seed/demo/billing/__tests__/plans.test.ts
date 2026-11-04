import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensurePlans } from "../plans";

describe("ensurePlans", () => {
  it("cree les six plans de demo avec les valeurs attendues, sans doublon au second appel", async () => {
    const first = await ensurePlans();
    const second = await ensurePlans();
    expect(await prisma.plan.count()).toBe(6);
    expect(second.pro.id).toBe(first.pro.id);

    const pick = (p: (typeof first)["free"]) => ({
      name: p.name, maxEvents: p.maxEvents, max: p.maxParticipantsPerEvent,
      period: p.period, price: p.price, archived: p.archived,
    });
    expect(pick(first.free)).toEqual({ name: "free", maxEvents: 1, max: 100, period: "MONTHLY", price: null, archived: false });
    expect(pick(first.standard)).toEqual({ name: "Standard", maxEvents: 10, max: 1000, period: "MONTHLY", price: 15000, archived: false });
    expect(pick(first.pro)).toEqual({ name: "demo-pro", maxEvents: 30, max: 5000, period: "MONTHLY", price: 30000, archived: false });
    expect(pick(first.enterprise)).toEqual({ name: "demo-entreprise-annuel", maxEvents: null, max: null, period: "ANNUAL", price: 450000, archived: false });
    expect(pick(first.partner)).toEqual({ name: "demo-partenaire", maxEvents: null, max: null, period: "ANNUAL", price: null, archived: false });
    expect(pick(first.legacy)).toEqual({ name: "demo-ancien-offre", maxEvents: 3, max: 300, period: "MONTHLY", price: 8000, archived: true });
  });

  it("expose trois plans publics avec position, description et caracteristiques", async () => {
    await ensurePlans();
    const visible = await prisma.plan.findMany({ where: { publicVisible: true }, orderBy: { position: "asc" } });
    expect(visible.map((p) => p.name)).toEqual(["Standard", "demo-pro", "demo-entreprise-annuel"]);
    expect(new Set(visible.map((p) => p.position)).size).toBe(3);
    expect(visible.filter((p) => p.highlighted).map((p) => p.name)).toEqual(["demo-pro"]);
    for (const p of visible) {
      expect(p.description).toBeTruthy();
      expect((p.features as string[]).length).toBeGreaterThan(0);
    }
    expect(await prisma.plan.count({ where: { publicVisible: false } })).toBe(3);
  });

  it("ne modifie pas un plan existant ajuste par le staff", async () => {
    await prisma.plan.create({ data: { name: "Standard", maxEvents: 5, maxParticipantsPerEvent: 50, price: 1 } });
    const plans = await ensurePlans();
    expect(plans.standard.maxEvents).toBe(5);
    expect(plans.standard.price).toBe(1);
    expect(plans.standard.publicVisible).toBe(true);
  });
});
