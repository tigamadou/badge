import { prisma } from "@/lib/prisma";
import { deletePrefix } from "@/lib/storage";
import { runMinimalSeed } from "../../../minimal";
import { createDemoContext, type DemoContext } from "../../context";
import { seedAccounts } from "../../accounts";
import { seedOrganizationsAndEvents } from "../../organizations";
import { seedRegistrations } from "../../registrations";

export const TEST_PREFIX = "demo/_test/";

export async function cleanTemplates(): Promise<void> {
  const rows = await prisma.installedBadgeTemplate.findMany({
    where: { family: { startsWith: "demo-" } },
    select: { id: true, assetPrefix: true },
  });
  await prisma.installedBadgeTemplate.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  for (const r of rows) await deletePrefix(r.assetPrefix);
}

/** Monde de demo reduit : seed minimal, comptes, organisations, evenements et inscriptions (facteur d'echelle faible). */
export async function buildWorld(scale = 0.02): Promise<DemoContext> {
  await cleanTemplates();
  await runMinimalSeed({ BADGE_ENV: "dev" });
  const ctx = await createDemoContext({
    env: { BADGE_ENV: "dev" },
    scale,
    storagePrefix: TEST_PREFIX,
    accountsFile: null,
  });
  await seedAccounts(ctx);
  await seedOrganizationsAndEvents(ctx);
  await seedRegistrations(ctx);
  return ctx;
}

export async function disposeWorld(ctx: DemoContext): Promise<void> {
  await cleanTemplates();
  await ctx.storage.clearTracked();
}
