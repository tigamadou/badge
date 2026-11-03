import { describe, it, expect, afterEach } from "vitest";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/storage";
import type { DemoContext } from "../../context";
import { seedCatalog } from "../catalog";
import { createPrintState } from "../helpers";
import { seedShowcaseOrders } from "../orders";
import { pdfPageCount, seedLayouts, seedSheets, sheetHooks } from "../sheets";
import { buildWorld, disposeWorld } from "./helpers";

describe("planches de demo", () => {
  let ctx: DemoContext;

  afterEach(async () => {
    await disposeWorld(ctx);
  });

  it("cree les gabarits, les planches de commande et les generations libres avec leurs fichiers", async () => {
    ctx = await buildWorld();
    const state = createPrintState(ctx);
    await seedCatalog(ctx, state);
    await seedLayouts(ctx, state);
    await seedShowcaseOrders(ctx, state, sheetHooks(ctx, state));
    await seedSheets(ctx, state);

    const layouts = await prisma.printSheetLayout.findMany({ where: { name: { startsWith: "Démo " } } });
    expect(layouts.length).toBeGreaterThanOrEqual(4);
    expect(layouts.some((l) => l.archived)).toBe(true);
    expect(new Set(layouts.map((l) => l.sheetOrientation)).size).toBeGreaterThanOrEqual(2);

    const generations = await prisma.printSheetGeneration.findMany();
    for (const status of ["PENDING", "RUNNING", "DONE", "FAILED"] as const) {
      expect(generations.some((g) => g.status === status), status).toBe(true);
    }
    expect(generations.some((g) => g.output === "ZIP" && g.status === "DONE")).toBe(true);
    expect(generations.some((g) => g.printRequestId)).toBe(true);
    expect(generations.some((g) => !g.printRequestId && g.output === "SHEETS")).toBe(true);
    expect(generations.some((g) => g.status === "DONE" && Array.isArray(g.skippedIds) && g.skippedIds.length > 0)).toBe(true);

    for (const g of generations.filter((x) => x.status === "DONE")) {
      expect(g.fileKey, g.id).not.toBeNull();
      const { body } = await getFile(g.fileKey!);
      expect(body.length).toBeGreaterThan(0);
      if (g.output === "ZIP") {
        expect(Object.keys((await JSZip.loadAsync(body)).files).length).toBeGreaterThan(0);
      } else {
        expect(await pdfPageCount(body)).toBe(g.sheetCount! * (g.duplex ? 2 : 1));
      }
      expect(g.completedAt).not.toBeNull();
    }
    for (const g of generations.filter((x) => x.status === "FAILED")) {
      expect(g.error).toBeTruthy();
      expect(g.fileKey).toBeNull();
    }
    for (const g of generations.filter((x) => x.status === "RUNNING")) expect(g.lockedBy).not.toBeNull();
  }, 600_000);
});
