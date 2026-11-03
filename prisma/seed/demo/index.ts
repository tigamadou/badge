import { assertDemoSeedAllowed } from "../../../src/lib/badge-env";
import { createDemoContext, type DemoContext, type DemoSeedOptions } from "./context";
import { cleanupDemoCore } from "./cleanup";
import { buildImageReserve } from "./images";
import { writeAccountsFile } from "./accounts-file";
import { seedAccounts } from "./accounts";
import { seedOrganizationsAndEvents } from "./organizations";
import { seedRegistrations } from "./registrations";
import { cleanupPrint, seedPrint } from "./print";
import { cleanupBilling, seedBilling } from "./billing";
import { cleanupNotificationsAndActivity, seedNotificationsAndActivity } from "./notifications";

export type { DemoSeedOptions } from "./context";

const DEFAULT_ACCOUNTS_FILE = ".demo/comptes-demo.md";

async function step(label: string, run: () => Promise<unknown>): Promise<void> {
  const start = Date.now();
  await run();
  console.log(`[seed demo] ${label} : ${((Date.now() - start) / 1000).toFixed(1)} s`);
}

export async function runDemoSeed(options: DemoSeedOptions = {}): Promise<DemoContext> {
  const env = options.env ?? process.env;
  assertDemoSeedAllowed(env);

  const ctx = await createDemoContext({ ...options, env });

  await step("nettoyage", async () => {
    await cleanupNotificationsAndActivity(ctx);
    await cleanupBilling(ctx);
    await cleanupPrint(ctx);
    await cleanupDemoCore(ctx);
    // Le nettoyage vide le prefixe `demo/` : la reserve d'images construite avec le contexte y est effacee.
    Object.assign(ctx.images, await buildImageReserve(ctx));
  });

  try {
    await step("comptes", () => seedAccounts(ctx));
    await step("organisations et evenements", () => seedOrganizationsAndEvents(ctx));
    await step("inscriptions", () => seedRegistrations(ctx));
    await step("impression", () => seedPrint(ctx));
    await step("facturation", () => seedBilling(ctx));
    await step("notifications et journal", () => seedNotificationsAndActivity(ctx));
    await ctx.parkJobs();
  } finally {
    // Meme en cas d'echec : les cles ecrites hors `demo/` doivent rester retrouvables.
    await ctx.storage.flushTrackedKeys();
  }

  const accountsFile = options.accountsFile === undefined
    ? (env.DEMO_ACCOUNTS_FILE ?? DEFAULT_ACCOUNTS_FILE)
    : options.accountsFile;
  if (accountsFile) await writeAccountsFile(ctx, accountsFile);

  return ctx;
}
