import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import type { DemoContext } from "../../context";
import { cleanupPrint } from "../../print";
import { seedCatalog } from "../catalog";
import { createPrintState } from "../helpers";
import { runScenario } from "../orders";
import { SCENARIOS } from "../scenarios";
import { buildWorld, disposeWorld } from "./helpers";

describe("cleanupPrint seul", () => {
  let ctx: DemoContext;
  const strays: { productId?: string; layoutId?: string } = {};

  afterEach(async () => {
    if (strays.productId) await prisma.printProduct.deleteMany({ where: { id: strays.productId } });
    if (strays.layoutId) await prisma.printSheetLayout.deleteMany({ where: { id: strays.layoutId } });
    strays.productId = undefined;
    strays.layoutId = undefined;
    await disposeWorld(ctx);
  });

  it("remet a zero les badges imprimes par la demo et epargne produits et gabarits etrangers", async () => {
    ctx = await buildWorld();
    const state = createPrintState(ctx);
    await seedCatalog(ctx, state);
    const scenario = SCENARIOS.find((s) => s.key === "o-in-production")!;
    const order = await runScenario(ctx, state, scenario);
    expect(order).not.toBeNull();

    const prints = await prisma.printRequestPrint.findMany({ where: { requestId: order!.requestId, reprint: false } });
    expect(prints.length).toBeGreaterThan(0);
    const ids = prints.map((p) => p.registrationId).filter((id): id is string => id !== null);
    expect(await prisma.registration.count({ where: { id: { in: ids }, badgePrinted: true } })).toBe(ids.length);

    const foreignProduct = await prisma.printProduct.create({
      data: { kind: "ACCESSORY", slug: "demo-etranger-dev", name: "Produit d'un developpeur", basePrice: 100 },
    });
    const foreignLayout = await prisma.printSheetLayout.create({
      data: {
        name: "Démo etranger", sheetWidth: 2100, sheetHeight: 2970, sheetOrientation: "PORTRAIT",
        marginTop: 100, marginRight: 100, marginBottom: 100, marginLeft: 100, gapHorizontal: 0, gapVertical: 0,
      },
    });
    strays.productId = foreignProduct.id;
    strays.layoutId = foreignLayout.id;

    await cleanupPrint(ctx);

    expect(await prisma.registration.count({ where: { id: { in: ids }, badgePrinted: true } })).toBe(0);
    expect(await prisma.registration.count({ where: { id: { in: ids }, badgePrintedAt: { not: null } } })).toBe(0);
    expect(await prisma.printProduct.findUnique({ where: { id: foreignProduct.id } })).not.toBeNull();
    expect(await prisma.printSheetLayout.findUnique({ where: { id: foreignLayout.id } })).not.toBeNull();
  }, 300_000);
});
