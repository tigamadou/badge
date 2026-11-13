import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { countOrdersToGenerate, listOrdersToGenerate, listOrdersWithSheet } from "@/lib/print-sheets/order-queue";
import {
  makeCategory,
  makeEvent,
  makeOrg,
  makePrintGeneration,
  makePrintOrder,
  makeRegistration,
  seedFactories,
} from "@/test/factories";

const template = vi.hoisted(() => ({ pages: 2 }));
vi.mock("@/lib/badge-templates/render-badge", () => ({
  resolveEventTemplate: vi.fn(async () => ({ meta: { pages: template.pages } })),
}));

let eventId: string;
let orgId: string;

beforeEach(async () => {
  seedFactories(7);
  template.pages = 2;
  const org = await makeOrg({ name: "Org Alpha" });
  const event = await makeEvent(org.id, { title: "Salon Alpha" });
  orgId = org.id;
  eventId = event.id;
});

describe("listOrdersToGenerate", () => {
  it("liste une commande ADVANCE payée sans planche, avec ses chiffres", async () => {
    const paidAt = new Date("2026-11-01T09:00:00.000Z");
    const order = await makePrintOrder({ eventId, orgId, status: "PAID", data: { paidAt } });
    const category = await makeCategory(eventId);
    const regs = [await makeRegistration(eventId, category.id), await makeRegistration(eventId, category.id)];
    await prisma.printRequestItem.createMany({
      data: regs.map((r, position) => ({ requestId: order.id, registrationId: r.id, position })),
    });
    expect(await listOrdersToGenerate()).toEqual([
      {
        requestId: order.id,
        reference: order.reference,
        status: "PAID",
        eventId,
        eventTitle: "Salon Alpha",
        orgName: "Org Alpha",
        badgeCount: 2,
        badgePages: 2,
        paidAt: paidAt.toISOString(),
        sheet: null,
      },
    ]);
  });

  it("inclut IN_PRODUCTION et exclut READY, ONSITE et les autres statuts", async () => {
    const inProd = await makePrintOrder({ eventId, orgId, status: "IN_PRODUCTION" });
    await makePrintOrder({ eventId, orgId, status: "READY" });
    await makePrintOrder({ eventId, orgId, status: "PAID", type: "ONSITE" });
    await makePrintOrder({ eventId, orgId, status: "ACCEPTED" });
    await makePrintOrder({ eventId, orgId, status: "COMPLETED" });
    const rows = await listOrdersToGenerate();
    expect(rows.map((r) => r.requestId)).toEqual([inProd.id]);
    expect(rows[0].paidAt).toBeNull();
  });

  it("exclut les commandes dont la planche est terminée (DONE) et garde les échecs", async () => {
    const done = await makePrintOrder({ eventId, orgId, status: "PAID", data: { paidAt: new Date("2026-11-01T10:00:00Z") } });
    const failed = await makePrintOrder({ eventId, orgId, status: "PAID", data: { paidAt: new Date("2026-11-01T11:00:00Z") } });
    const open = await makePrintOrder({ eventId, orgId, status: "PAID", data: { paidAt: new Date("2026-11-01T12:00:00Z") } });
    await makePrintGeneration({ eventId, printRequestId: done.id, data: { status: "DONE" } });
    await makePrintGeneration({ eventId, printRequestId: failed.id, data: { status: "FAILED" } });
    const rows = await listOrdersToGenerate();
    expect(rows.map((r) => r.requestId)).toEqual([failed.id, open.id]);
    expect(rows[0].sheet?.status).toBe("FAILED");
  });

  it("prend les pages du template de l'évènement quand la commande n'en fige pas", async () => {
    template.pages = 1;
    await makePrintOrder({ eventId, orgId, status: "PAID" });
    expect((await listOrdersToGenerate())[0].badgePages).toBe(1);
  });

  it("préfère les pages figées par la commande", async () => {
    template.pages = 1;
    await makePrintOrder({ eventId, orgId, status: "PAID", data: { badgePages: 2 } });
    expect((await listOrdersToGenerate())[0].badgePages).toBe(2);
  });
});

describe("listOrdersWithSheet", () => {
  it("liste DONE, FAILED, PENDING et RUNNING, la plus récente d'abord, avec la planche", async () => {
    const older = await makePrintOrder({ eventId, orgId, status: "PAID" });
    const newer = await makePrintOrder({ eventId, orgId, status: "IN_PRODUCTION" });
    const failed = await makePrintOrder({ eventId, orgId, status: "PAID" });
    const running = await makePrintOrder({ eventId, orgId, status: "PAID" });
    await makePrintOrder({ eventId, orgId, status: "PAID" }); // sans planche
    const gen = (id: string, status: "DONE" | "PENDING" | "FAILED" | "RUNNING", at: string, error?: string) =>
      makePrintGeneration({
        eventId,
        printRequestId: id,
        data: { status, createdAt: new Date(at), ...(error ? { error } : {}) },
      });
    await gen(older.id, "DONE", "2026-11-01T10:00:00Z");
    await gen(newer.id, "PENDING", "2026-11-01T12:00:00Z");
    await gen(failed.id, "FAILED", "2026-11-01T11:00:00Z", "boom");
    await gen(running.id, "RUNNING", "2026-11-01T09:00:00Z");
    const rows = await listOrdersWithSheet();
    expect(rows.map((r) => r.requestId)).toEqual([newer.id, failed.id, older.id, running.id]);
    expect(rows.map((r) => r.sheet?.status)).toEqual(["PENDING", "FAILED", "DONE", "RUNNING"]);
    expect(rows[1].sheet?.error).toBe("boom");
  });

  it("exclut ONSITE, READY et COMPLETED même avec une planche", async () => {
    const onsite = await makePrintOrder({ eventId, orgId, status: "PAID", type: "ONSITE" });
    const ready = await makePrintOrder({ eventId, orgId, status: "READY" });
    await makePrintGeneration({ eventId, printRequestId: onsite.id, data: { status: "DONE" } });
    await makePrintGeneration({ eventId, printRequestId: ready.id, data: { status: "DONE" } });
    expect(await listOrdersWithSheet()).toEqual([]);
  });
});

describe("countOrdersToGenerate", () => {
  it("compte les commandes à traiter, génération en cours comprise, comme la liste", async () => {
    await makePrintOrder({ eventId, orgId, status: "PAID" });
    await makePrintOrder({ eventId, orgId, status: "IN_PRODUCTION" });
    await makePrintOrder({ eventId, orgId, status: "PAID", type: "ONSITE" });
    const done = await makePrintOrder({ eventId, orgId, status: "PAID" });
    await makePrintGeneration({ eventId, printRequestId: done.id, data: { status: "DONE" } });
    const running = await makePrintOrder({ eventId, orgId, status: "PAID" });
    await makePrintGeneration({ eventId, printRequestId: running.id, data: { status: "RUNNING" } });
    expect(await countOrdersToGenerate()).toBe(3);
  });
});
