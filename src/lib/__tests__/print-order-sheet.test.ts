import { beforeEach, describe, expect, it } from "vitest";
import { getOrderSheet } from "@/lib/print-sheets/order-sheet";
import { makeEvent, makeOrg, makePrintGeneration, makePrintLayout, makePrintOrder, seedFactories } from "@/test/factories";

let eventId: string;
let orgId: string;

beforeEach(async () => {
  seedFactories(5);
  const org = await makeOrg();
  const event = await makeEvent(org.id);
  orgId = org.id;
  eventId = event.id;
});

describe("getOrderSheet", () => {
  it("retourne null quand la commande n'a pas de planche", async () => {
    const order = await makePrintOrder({ eventId, orgId });
    expect(await getOrderSheet(order.id)).toBeNull();
  });

  it("planche en cours : pas de lien de téléchargement ni de chiffres", async () => {
    const order = await makePrintOrder({ eventId, orgId });
    const gen = await makePrintGeneration({ eventId, printRequestId: order.id, data: { status: "RUNNING" } });
    expect(await getOrderSheet(order.id)).toEqual({
      generationId: gen.id,
      status: "RUNNING",
      layoutName: null,
      duplex: false,
      badgeCount: null,
      sheetCount: null,
      pageCount: null,
      completedAt: null,
      error: null,
      downloadUrl: null,
    });
  });

  it("planche prête recto seul : pages = feuilles, lien de téléchargement", async () => {
    const order = await makePrintOrder({ eventId, orgId });
    const layout = await makePrintLayout({ name: "A4 recto" });
    const completedAt = new Date("2026-11-02T10:00:00.000Z");
    const gen = await makePrintGeneration({
      eventId,
      printRequestId: order.id,
      layoutId: layout.id,
      data: { status: "DONE", badgeCount: 12, sheetCount: 3, completedAt },
    });
    expect(await getOrderSheet(order.id)).toEqual({
      generationId: gen.id,
      status: "DONE",
      layoutName: "A4 recto",
      duplex: false,
      badgeCount: 12,
      sheetCount: 3,
      pageCount: 3,
      completedAt: completedAt.toISOString(),
      error: null,
      downloadUrl: `/api/files/print-sheets/${gen.id}.pdf`,
    });
  });

  it("prête avec fileKey : le lien suit la clé de fichier", async () => {
    const order = await makePrintOrder({ eventId, orgId });
    await makePrintGeneration({
      eventId,
      printRequestId: order.id,
      data: { status: "DONE", sheetCount: 1, fileKey: "print-sheets/custom.pdf" },
    });
    expect((await getOrderSheet(order.id))?.downloadUrl).toBe("/api/files/print-sheets/custom.pdf");
  });

  it("planche prête recto-verso : pages = 2 x feuilles", async () => {
    const order = await makePrintOrder({ eventId, orgId });
    await makePrintGeneration({
      eventId,
      printRequestId: order.id,
      data: { status: "DONE", duplex: true, badgeCount: 12, sheetCount: 3 },
    });
    const view = await getOrderSheet(order.id);
    expect(view?.pageCount).toBe(6);
    expect(view?.duplex).toBe(true);
  });

  it("planche en échec : message d'erreur, pas de lien", async () => {
    const order = await makePrintOrder({ eventId, orgId });
    await makePrintGeneration({ eventId, printRequestId: order.id, data: { status: "FAILED", error: "boom" } });
    const view = await getOrderSheet(order.id);
    expect(view).toMatchObject({ status: "FAILED", error: "boom", downloadUrl: null, pageCount: null });
  });
});
