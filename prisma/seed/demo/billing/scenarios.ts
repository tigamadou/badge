import type { PaymentStatus, SubscriptionChangeMode, SubscriptionStatus } from "@prisma/client";
import type { PlanKey } from "./plans";
import type { DemoWorld, WorldOrg } from "./world";

/** `daysAgo` : ancienneté de l'approbation (APPROVED) ou de la création (autres statuts). Fractions de jour admises. */
export type PaymentSpec = {
  /** Plan visé ; par défaut celui du scénario. */
  plan?: PlanKey;
  status: PaymentStatus;
  mode?: SubscriptionChangeMode;
  daysAgo: number;
};

export type Scenario = {
  key: string;
  plan: PlanKey;
  status: SubscriptionStatus;
  startDaysAgo: number;
  /** null = sans échéance. */
  endInDays: number | null;
  scheduledPlan?: PlanKey;
  /** `daysBefore` des rappels déjà envoyés. */
  reminders: number[];
  overrides?: "near-limit" | "partner";
  /** Abonnement créé ou offert par le staff plateforme. */
  byStaff?: boolean;
  /** Préfère une organisation qui a un OWNER (paiements, rappels et notifications leur sont destinés). */
  preferOwner?: boolean;
  payments: PaymentSpec[];
};

const MINUTE = 1 / 1440;

export const SCENARIOS: Scenario[] = [
  { key: "big-annual", preferOwner: true, plan: "enterprise", status: "ACTIVE", startDaysAgo: 120, endInDays: 245, reminders: [],
    payments: [{ status: "APPROVED", mode: "IMMEDIATE", daysAgo: 120 }] },
  { key: "monthly-renewed", preferOwner: true, plan: "standard", status: "ACTIVE", startDaysAgo: 45, endInDays: 15, reminders: [],
    payments: [
      { status: "APPROVED", mode: "IMMEDIATE", daysAgo: 45 },
      { status: "APPROVED", mode: "EXTENSION", daysAgo: 20 },
    ] },
  { key: "expiring-7", preferOwner: true, plan: "standard", status: "ACTIVE", startDaysAgo: 24, endInDays: 6, reminders: [7],
    payments: [
      { status: "APPROVED", mode: "IMMEDIATE", daysAgo: 24 },
      { status: "DECLINED", daysAgo: 50 },
    ] },
  { key: "expiring-1", preferOwner: true, plan: "standard", status: "ACTIVE", startDaysAgo: 29, endInDays: 1, reminders: [7, 1],
    payments: [{ status: "APPROVED", mode: "IMMEDIATE", daysAgo: 29 }] },
  { key: "expired-renewable", plan: "standard", status: "EXPIRED", startDaysAgo: 39, endInDays: -9, reminders: [7, 1],
    payments: [
      { status: "APPROVED", mode: "IMMEDIATE", daysAgo: 39 },
      { status: "CANCELED", daysAgo: 5 },
    ] },
  { key: "downgrade-scheduled", plan: "pro", status: "ACTIVE", startDaysAgo: 10, endInDays: 20, scheduledPlan: "standard", reminders: [],
    // Standard payé il y a 20 jours, puis montée en gamme vers Pro il y a 10 jours (crédit au prorata),
    // puis retour programmé vers Standard.
    payments: [
      { plan: "standard", status: "APPROVED", mode: "IMMEDIATE", daysAgo: 20 },
      { status: "APPROVED", mode: "IMMEDIATE", daysAgo: 10 },
      { plan: "standard", status: "APPROVED", mode: "SCHEDULED", daysAgo: 3 },
    ] },
  { key: "trial", plan: "free", status: "ACTIVE", startDaysAgo: 10, endInDays: 20, reminders: [], byStaff: true,
    payments: [{ plan: "standard", status: "PENDING", daysAgo: 10 * MINUTE }] },
  { key: "trial-expired", plan: "free", status: "EXPIRED", startDaysAgo: 55, endInDays: -25, reminders: [],
    payments: [{ plan: "standard", status: "EXPIRED", daysAgo: 24 }] },
  { key: "cancelled", plan: "standard", status: "CANCELLED", startDaysAgo: 20, endInDays: 10, reminders: [], byStaff: true,
    payments: [{ status: "APPROVED", mode: "IMMEDIATE", daysAgo: 20 }] },
  { key: "partner-open", plan: "partner", status: "ACTIVE", startDaysAgo: 90, endInDays: null, reminders: [],
    overrides: "partner", byStaff: true, payments: [] },
  { key: "near-limit", plan: "standard", status: "ACTIVE", startDaysAgo: 8, endInDays: 22, reminders: [], overrides: "near-limit",
    payments: [{ status: "APPROVED", mode: "IMMEDIATE", daysAgo: 8 }] },
  { key: "archived-expired", plan: "legacy", status: "EXPIRED", startDaysAgo: 150, endInDays: -120, reminders: [],
    payments: [{ status: "APPROVED", mode: "IMMEDIATE", daysAgo: 150 }] },
];

/**
 * Distribue les scénarios : l'organisation archivée prend `archived-expired`, les autres suivent
 * l'ordre du tableau en prenant la plus grosse organisation restante. Seuls 4 organisations sur 12 ont un
 * OWNER : les scénarios `preferOwner` prennent d'abord une organisation avec OWNER, les autres une sans
 * (repli sur la première restante). En boucle si le monde en compte davantage. Déterministe, sans faker.
 */
export function assignScenarios(world: DemoWorld): { org: WorldOrg; scenario: Scenario }[] {
  const archivedScenario = SCENARIOS.find((s) => s.key === "archived-expired")!;
  const running = SCENARIOS.filter((s) => s !== archivedScenario);
  const remaining = world.orgs.filter((o) => !o.archived);
  const picked = new Map<string, Scenario>();
  for (let i = 0; remaining.length > 0; i++) {
    const scenario = running[i % running.length];
    const wantsOwner = scenario.preferOwner === true;
    const org = remaining.find((o) => (o.owners.length > 0) === wantsOwner) ?? remaining[0];
    remaining.splice(remaining.indexOf(org), 1);
    picked.set(org.id, scenario);
  }
  return world.orgs.map((org) => ({ org, scenario: org.archived ? archivedScenario : picked.get(org.id)! }));
}
