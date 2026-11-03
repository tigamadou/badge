import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import type { PrintRequestStatus, PrintRequestType } from "@prisma/client";
import type { DemoContext } from "../../context";
import { seedCatalog } from "../catalog";
import { cleanupPrintData, createPrintState } from "../helpers";
import { seedShowcaseOrders } from "../orders";
import { buildWorld, disposeWorld } from "./helpers";

const STATUSES: PrintRequestStatus[] = [
  "DRAFT", "SUBMITTED", "QUOTED", "ACCEPTED", "PAID", "IN_PRODUCTION", "READY", "COMPLETED", "REJECTED", "CANCELLED",
];
const RESERVING: PrintRequestStatus[] = ["SUBMITTED", "QUOTED", "ACCEPTED", "PAID", "IN_PRODUCTION", "READY", "COMPLETED"];

describe("seedShowcaseOrders", () => {
  let ctx: DemoContext;

  afterEach(async () => {
    await disposeWorld(ctx);
  });

  it("rejoue un cas par statut et par type, avec des totaux et des reservations coherents", async () => {
    ctx = await buildWorld();
    const state = createPrintState(ctx);
    await seedCatalog(ctx, state);
    const orders = await seedShowcaseOrders(ctx, state);
    expect(orders.size).toBeGreaterThanOrEqual(20);

    const requests = await prisma.printRequest.findMany({
      include: { lines: true, items: { include: { registration: true } }, messages: true },
    });
    for (const status of STATUSES) expect(requests.some((r) => r.status === status), status).toBe(true);
    for (const type of ["ADVANCE", "ONSITE"] as PrintRequestType[]) expect(requests.some((r) => r.type === type), type).toBe(true);
    expect(requests.some((r) => r.delivery === "PICKUP")).toBe(true);
    expect(requests.some((r) => r.delivery === "DELIVERY")).toBe(true);
    expect(requests.some((r) => r.parentRequestId !== null)).toBe(true);

    const showcase = requests.filter((r) => [...orders.values()].includes(r.id));
    for (const r of requests) {
      const active = r.lines.filter((l) => l.removedAt === null);
      expect(r.total, r.reference).toBe(active.reduce((sum, l) => sum + l.lineTotal, 0));
      expect(new Set(r.reference).size).toBeGreaterThan(0);
      const sent = r.messages.filter((m) => m.eventType === "QUOTE_SENT").length;
      if (r.parentRequestId === null) expect(r.quoteVersion, r.reference).toBe(sent);
      if (["ACCEPTED", "PAID", "IN_PRODUCTION", "READY", "COMPLETED"].includes(r.status)) {
        expect(r.acceptedTotal, r.reference).not.toBeNull();
        expect(r.acceptedVersion, r.reference).not.toBeNull();
      }
      for (const item of r.items) {
        expect(item.registration.eventId).toBe(r.eventId);
        expect(item.registration.status).toBe("APPROVED");
      }
    }
    expect(showcase.some((r) => r.quoteVersion === 3)).toBe(true);
    const lines = requests.flatMap((r) => r.lines);
    for (const kind of ["PRODUCT", "SERVICE", "DISCOUNT", "CUSTOM"]) expect(lines.some((l) => l.kind === kind), kind).toBe(true);
    expect(lines.some((l) => l.removedAt !== null)).toBe(true);
    expect(lines.some((l) => l.usesOrgCredit)).toBe(true);
    // acceptedTotal = total de la version acceptee : le total n'a pas bouge depuis l'acceptation.
    for (const r of requests.filter((x) => ["ACCEPTED", "PAID", "IN_PRODUCTION", "READY"].includes(x.status))) {
      expect(r.acceptedTotal, r.reference).toBe(r.total);
    }

    // Une inscription n'est reservee que par une commande reservante par evenement.
    const owners = new Map<string, string>();
    for (const r of requests.filter((x) => RESERVING.includes(x.status))) {
      for (const item of r.items) {
        expect(owners.has(item.registrationId), `${item.registrationId} deja reservee`).toBe(false);
        owners.set(item.registrationId, r.id);
      }
    }

    // Dates dans le passe et dans l'ordre.
    for (const r of requests) {
      expect(r.createdAt.getTime()).toBeLessThanOrEqual(ctx.dates.now.getTime());
      expect(r.updatedAt.getTime()).toBeLessThanOrEqual(ctx.dates.now.getTime());
      if (r.submittedAt && r.quotedAt) expect(r.submittedAt.getTime()).toBeLessThanOrEqual(r.quotedAt.getTime());
      if (r.acceptedAt && r.paidAt) expect(r.acceptedAt.getTime()).toBeLessThan(r.paidAt.getTime());
      if (r.paidAt && r.completedAt) expect(r.paidAt.getTime()).toBeLessThan(r.completedAt.getTime());
      for (const m of r.messages) expect(m.createdAt.getTime()).toBeLessThanOrEqual(ctx.dates.now.getTime());
    }

    // Idempotence : un second passage apres nettoyage ne double rien.
    const count = requests.length;
    const refs = new Set(requests.map((r) => r.reference));
    expect(refs.size).toBe(count);
    await prisma.printRequest.updateMany({ data: { parentRequestId: null } });
    await prisma.printRequest.deleteMany();
    await cleanupPrintData();
    const state2 = createPrintState(ctx);
    await seedCatalog(ctx, state2);
    await seedShowcaseOrders(ctx, state2);
    expect(await prisma.printRequest.count()).toBe(count);
  }, 600_000);
});
