import type { DemoContext } from "./context";
import { parkAllPrintJobs, seedPrintActivity } from "./print/activity";
import { seedCatalog } from "./print/catalog";
import { conversationHooks, seedReadStates } from "./print/conversation";
import { cleanupPrintData, createPrintState, type PrintState } from "./print/helpers";
import { seedShowcaseOrders, type ScenarioHooks } from "./print/orders";
import { seedLayouts, seedSheets, sheetHooks } from "./print/sheets";
import { seedVolumeOrders } from "./print/volume";

async function timed(label: string, run: () => Promise<unknown>): Promise<void> {
  const start = Date.now();
  await run();
  console.log(`[seed demo] impression / ${label} : ${((Date.now() - start) / 1000).toFixed(1)} s`);
}

export async function cleanupPrint(_ctx: DemoContext): Promise<void> {
  void _ctx;
  await cleanupPrintData();
}

function mergeHooks(...all: ScenarioHooks[]): ScenarioHooks {
  const merged: ScenarioHooks = {};
  for (const hooks of all) {
    for (const [phase, hook] of Object.entries(hooks) as Array<[keyof ScenarioHooks, NonNullable<ScenarioHooks[keyof ScenarioHooks]>]>) {
      const previous = merged[phase];
      merged[phase] = previous ? async (ref) => { await previous(ref); await hook(ref); } : hook;
    }
  }
  return merged;
}

export async function seedPrint(ctx: DemoContext): Promise<void> {
  if (ctx.registry.events.length === 0) {
    console.warn("[seed demo] impression : aucun evenement de demo, etape ignoree");
    return;
  }
  const state: PrintState = createPrintState(ctx);
  await timed("nettoyage", () => cleanupPrintData());
  await timed("catalogue", () => seedCatalog(ctx, state));
  await timed("gabarits", () => seedLayouts(ctx, state));
  await timed("commandes vitrine, conversations, paiements et planches", () =>
    seedShowcaseOrders(ctx, state, mergeHooks(conversationHooks(ctx, state), sheetHooks(ctx, state))),
  );
  await timed("etats de lecture", () => seedReadStates(ctx, state));
  await timed("generations libres", () => seedSheets(ctx, state));
  await timed("volume", () => seedVolumeOrders(ctx, state));
  await timed("journal et notifications", () => seedPrintActivity(ctx, state));
  await timed("jobs parques", async () => {
    const parked = await parkAllPrintJobs(ctx, state);
    console.log(`[seed demo] impression / ${parked} job(s) d'email parque(s)`);
  });
}
