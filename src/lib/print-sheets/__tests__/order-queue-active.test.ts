import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { countOrdersToGenerate, listOrdersToGenerate, listOrdersWithSheet } from "@/lib/print-sheets/order-queue";
import { makeEvent, makeOrg, makePrintGeneration, makePrintOrder, seedFactories } from "@/test/factories";

vi.mock("@/lib/badge-templates/render-badge", () => ({
  resolveEventTemplate: vi.fn(async () => ({ meta: { pages: 1 } })),
}));

let eventId: string;
let orgId: string;

beforeEach(async () => {
  seedFactories(11);
  const org = await makeOrg();
  const event = await makeEvent(org.id);
  orgId = org.id;
  eventId = event.id;
});

describe("file « À traiter » : une génération non terminée garde la commande", () => {
  it.each(["PENDING", "RUNNING", "FAILED"] as const)("reste dans la file avec une génération %s", async (status) => {
    const order = await makePrintOrder({ eventId, orgId, status: "PAID" });
    await makePrintGeneration({ eventId, printRequestId: order.id, data: { status } });
    const rows = await listOrdersToGenerate();
    expect(rows.map((r) => r.requestId)).toEqual([order.id]);
    expect(rows[0].sheet?.status).toBe(status);
    expect(await countOrdersToGenerate()).toBe(1);
  });

  it("sort de la file à DONE, et le compteur suit", async () => {
    const order = await makePrintOrder({ eventId, orgId, status: "PAID" });
    const generation = await makePrintGeneration({ eventId, printRequestId: order.id, data: { status: "RUNNING" } });
    expect(await countOrdersToGenerate()).toBe(1);
    await prisma.printSheetGeneration.update({ where: { id: generation.id }, data: { status: "DONE" } });
    expect(await listOrdersToGenerate()).toEqual([]);
    expect(await countOrdersToGenerate()).toBe(0);
  });

  it("« Générées » liste toute génération, quel que soit son état", async () => {
    const running = await makePrintOrder({ eventId, orgId, status: "PAID" });
    const done = await makePrintOrder({ eventId, orgId, status: "PAID" });
    await makePrintGeneration({ eventId, printRequestId: running.id, data: { status: "RUNNING" } });
    await makePrintGeneration({ eventId, printRequestId: done.id, data: { status: "DONE" } });
    const ids = (await listOrdersWithSheet()).map((r) => r.requestId).sort();
    expect(ids).toEqual([running.id, done.id].sort());
  });
});
