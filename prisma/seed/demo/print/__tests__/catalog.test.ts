import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/storage";
import type { DemoContext } from "../../context";
import { seedCatalog } from "../catalog";
import { cleanupPrintData, createPrintState } from "../helpers";
import { buildWorld, disposeWorld } from "./helpers";

describe("seedCatalog", () => {
  let ctx: DemoContext;

  afterEach(async () => {
    await disposeWorld(ctx);
  });

  it("cree un catalogue complet, avec images lisibles, et reste idempotent", async () => {
    ctx = await buildWorld();
    const state = createPrintState(ctx);
    await seedCatalog(ctx, state);

    const products = await prisma.printProduct.findMany({
      where: { slug: { startsWith: "demo-" } },
      include: { images: true, priceTiers: true, options: { include: { values: true } } },
    });
    const badges = products.filter((p) => p.kind === "BADGE");
    const accessories = products.filter((p) => p.kind === "ACCESSORY");
    expect(badges.length).toBeGreaterThanOrEqual(3);
    expect(accessories.length).toBeGreaterThanOrEqual(4);
    expect(badges.some((p) => p.priceTiers.length >= 2)).toBe(true);

    const types = new Set(products.flatMap((p) => p.options.map((o) => o.type)));
    for (const type of ["CHOICE", "MULTI_CHOICE", "COLOR", "TEXT", "FILE", "QUANTITY_SPLIT"]) {
      expect(types.has(type as never)).toBe(true);
    }

    expect(products.some((p) => p.published && !p.archived)).toBe(true);
    expect(products.some((p) => !p.published && !p.archived)).toBe(true);
    const archived = products.find((p) => p.archived);
    expect(archived?.archivedAt).not.toBeNull();
    const options = products.flatMap((p) => p.options);
    expect(options.some((o) => o.archived && o.archivedAt)).toBe(true);
    expect(options.flatMap((o) => o.values).some((v) => v.archived && v.archivedAt)).toBe(true);
    expect(options.filter((o) => o.type === "COLOR").every((o) => o.values.every((v) => v.colorHex))).toBe(true);

    const keys = [
      ...products.flatMap((p) => p.images.map((i) => i.storageKey)),
      ...options.flatMap((o) => o.values.map((v) => v.imageKey).filter((k): k is string => !!k)),
    ];
    expect(keys.length).toBeGreaterThan(5);
    for (const key of keys) await expect(getFile(key)).resolves.toBeDefined();

    expect(state.products.badge.length).toBeGreaterThanOrEqual(3);
    expect(state.products.accessories.length).toBeGreaterThanOrEqual(2);

    await cleanupPrintData();
    expect(await prisma.printProduct.count({ where: { slug: { startsWith: "demo-" } } })).toBe(0);
    await seedCatalog(ctx, createPrintState(ctx));
    await cleanupPrintData();
    await seedCatalog(ctx, createPrintState(ctx));
    expect(await prisma.printProduct.count({ where: { slug: { startsWith: "demo-" } } })).toBe(products.length);
  }, 120_000);
});
