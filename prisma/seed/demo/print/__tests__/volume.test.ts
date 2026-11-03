import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import type { DemoContext } from "../../context";
import { seedCatalog } from "../catalog";
import { createPrintState } from "../helpers";
import { seedVolumeOrders } from "../volume";
import { buildWorld, disposeWorld } from "./helpers";

describe("commandes de volume", () => {
  let ctx: DemoContext;

  afterEach(async () => {
    await disposeWorld(ctx);
  });

  it("ecrit des commandes coherentes, reparties par statut, avec des references uniques", async () => {
    ctx = await buildWorld(0.05);
    const state = createPrintState(ctx);
    await seedCatalog(ctx, state);
    await seedVolumeOrders(ctx, state);

    expect(state.volume.length).toBeGreaterThan(0);
    const bigOrgs = [...ctx.registry.orgsBySize.medium, ...ctx.registry.orgsBySize.huge].filter((o) => !o.archived);
    for (const org of bigOrgs) {
      const hasEvents = (ctx.registry.eventsByOrg.get(org.id) ?? []).some((e) => !e.archived);
      if (hasEvents) expect(state.volume.some((v) => v.orgId === org.id), org.slug).toBe(true);
    }

    const requests = await prisma.printRequest.findMany({
      where: { id: { in: state.volume.map((v) => v.id) } },
      include: { items: true, lines: true, messages: { orderBy: { createdAt: "asc" } }, payments: true },
    });
    expect(requests).toHaveLength(state.volume.length);
    expect(new Set(requests.map((r) => r.status)).size).toBeGreaterThanOrEqual(6);

    const references = requests.map((r) => r.reference);
    expect(new Set(references).size).toBe(references.length);
    for (const reference of references) expect(reference).toMatch(/^IMP-\d{4}-\d{4}$/);

    const reserved = new Map<string, Set<string>>();
    for (const r of requests) {
      expect(r.type).toBe("ADVANCE");
      expect(r.total, r.reference).toBe(r.lines.reduce((sum, l) => sum + l.lineTotal, 0));
      expect(r.lines.length).toBeGreaterThanOrEqual(1);
      expect(r.lines.length).toBeLessThanOrEqual(4);
      expect(r.createdAt.getTime()).toBeLessThanOrEqual(ctx.dates.now.getTime());
      expect(r.updatedAt.getTime()).toBeLessThanOrEqual(ctx.dates.now.getTime());
      if (r.status !== "DRAFT") expect(r.submittedAt, r.reference).not.toBeNull();
      if (["PAID", "IN_PRODUCTION", "READY", "COMPLETED"].includes(r.status)) {
        expect(r.paidAt, r.reference).not.toBeNull();
        expect(r.acceptedTotal).toBe(r.total);
      }
      if (r.status === "COMPLETED") expect(r.completedAt).not.toBeNull();
      if (r.status === "CANCELLED") expect(r.cancelledAt).not.toBeNull();
      const dates = r.messages.map((m) => m.createdAt.getTime());
      expect(dates).toEqual([...dates].sort((a, b) => a - b));
      for (const p of r.payments) {
        expect(p.fedapayTransactionId).toBeGreaterThanOrEqual(920_000_000);
        expect(p.fedapayTransactionId).toBeLessThanOrEqual(929_999_999);
      }
      if (!["DRAFT", "REJECTED", "CANCELLED"].includes(r.status)) {
        const set = reserved.get(r.eventId) ?? new Set<string>();
        for (const item of r.items) {
          expect(set.has(item.registrationId), `${r.reference} ${item.registrationId}`).toBe(false);
          set.add(item.registrationId);
        }
        reserved.set(r.eventId, set);
      }
    }
  }, 600_000);
});
