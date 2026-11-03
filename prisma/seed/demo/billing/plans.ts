import type { Plan } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { DEFAULT_PLAN_NAME } from "../../../../src/lib/subscription";

export type PlanKey = "free" | "standard" | "pro" | "enterprise" | "partner" | "legacy";
export type PlanCatalog = Record<PlanKey, Plan>;

const DAY_MS = 86_400_000;

type PlanSpec = {
  name: string; maxEvents: number | null; maxParticipantsPerEvent: number | null;
  period: "MONTHLY" | "ANNUAL"; price: number | null; archived?: boolean;
};

export const PLAN_SPECS: Record<PlanKey, PlanSpec> = {
  free: { name: DEFAULT_PLAN_NAME, maxEvents: 1, maxParticipantsPerEvent: 100, period: "MONTHLY", price: null },
  standard: { name: "Standard", maxEvents: 10, maxParticipantsPerEvent: 1000, period: "MONTHLY", price: 15000 },
  pro: { name: "demo-pro", maxEvents: 30, maxParticipantsPerEvent: 5000, period: "MONTHLY", price: 30000 },
  enterprise: { name: "demo-entreprise-annuel", maxEvents: null, maxParticipantsPerEvent: null, period: "ANNUAL", price: 450000 },
  partner: { name: "demo-partenaire", maxEvents: null, maxParticipantsPerEvent: null, period: "ANNUAL", price: null },
  legacy: { name: "demo-ancien-offre", maxEvents: 3, maxParticipantsPerEvent: 300, period: "MONTHLY", price: 8000, archived: true },
};

/**
 * Upsert par nom des plans de démo. `update` ne touche que `archived` : un plan existant (free, Standard)
 * garde les valeurs du seed minimal ou ajustées par le staff.
 */
export async function ensurePlans(now: Date = new Date()): Promise<PlanCatalog> {
  const createdAt = new Date(now.getTime() - 400 * DAY_MS);
  const catalog: Partial<PlanCatalog> = {};
  for (const [key, spec] of Object.entries(PLAN_SPECS) as [PlanKey, PlanSpec][]) {
    catalog[key] = await prisma.plan.upsert({
      where: { name: spec.name },
      create: { ...spec, archived: spec.archived ?? false, createdAt },
      update: { archived: spec.archived ?? false },
    });
  }
  return catalog as PlanCatalog;
}
