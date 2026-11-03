import type { DemoContext } from "./context";
import { seedCatalog } from "./print/catalog";
import { cleanupPrintData, createPrintState, type PrintState } from "./print/helpers";

async function timed(label: string, run: () => Promise<unknown>): Promise<void> {
  const start = Date.now();
  await run();
  console.log(`[seed demo] impression / ${label} : ${((Date.now() - start) / 1000).toFixed(1)} s`);
}

export async function cleanupPrint(_ctx: DemoContext): Promise<void> {
  void _ctx;
  await cleanupPrintData();
}

export async function seedPrint(ctx: DemoContext): Promise<void> {
  const state: PrintState = createPrintState(ctx);
  await timed("nettoyage", () => cleanupPrintData());
  await timed("catalogue", () => seedCatalog(ctx, state));
}
