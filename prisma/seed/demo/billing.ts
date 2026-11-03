import { prisma } from "../../../src/lib/prisma";
import { DEMO_SLUG_PREFIX } from "../constants";
import type { DemoContext } from "./context";
import { ensurePlans } from "./billing/plans";

export async function seedBilling(ctx: DemoContext): Promise<void> {
  await ensurePlans(ctx.dates.now);
}

/**
 * Supprime paiements et abonnements des organisations `demo-` (rappels en cascade). Les plans
 * `demo-*` restent : ils sont recrees par `upsert` et `Payment.planId` est RESTRICT.
 */
export async function cleanupBilling(_ctx: DemoContext): Promise<void> {
  const orgs = { org: { slug: { startsWith: DEMO_SLUG_PREFIX } } };
  await prisma.payment.deleteMany({ where: orgs });
  await prisma.subscription.deleteMany({ where: orgs });
}
