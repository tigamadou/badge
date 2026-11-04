import { Prisma, type Plan } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { DEFAULT_PLAN_NAME } from "../../../../src/lib/subscription";

export type PlanKey = "free" | "standard" | "pro" | "enterprise" | "partner" | "legacy";
export type PlanCatalog = Record<PlanKey, Plan>;

const DAY_MS = 86_400_000;

type PlanSpec = {
  name: string; maxEvents: number | null; maxParticipantsPerEvent: number | null;
  period: "MONTHLY" | "ANNUAL"; price: number | null; archived?: boolean;
  /** Fiche publique (/tarifs) : absente = plan non visible. */
  publicSheet?: { position: number; description: string; features: string[]; highlighted?: boolean };
};

export const PLAN_SPECS: Record<PlanKey, PlanSpec> = {
  free: { name: DEFAULT_PLAN_NAME, maxEvents: 1, maxParticipantsPerEvent: 100, period: "MONTHLY", price: null },
  standard: {
    name: "Standard", maxEvents: 10, maxParticipantsPerEvent: 1000, period: "MONTHLY", price: 15000,
    publicSheet: {
      position: 10,
      description: "Pour les organisations qui lancent leurs premiers événements.",
      features: ["Badges PDF avec QR code", "Scanner mobile", "Support par e-mail"],
    },
  },
  pro: {
    name: "demo-pro", maxEvents: 30, maxParticipantsPerEvent: 5000, period: "MONTHLY", price: 30000,
    publicSheet: {
      position: 20,
      description: "Pour les organisations qui multiplient les événements.",
      features: ["Badges PDF avec QR code", "Scanner mobile", "Rôles et permissions avancés", "Journal d'activité complet"],
      highlighted: true,
    },
  },
  enterprise: {
    name: "demo-entreprise-annuel", maxEvents: null, maxParticipantsPerEvent: null, period: "ANNUAL", price: 450000,
    publicSheet: {
      position: 30,
      description: "Volumes illimités, facturés à l'année.",
      features: ["Événements et participants illimités", "Rôles et permissions avancés", "Accompagnement dédié"],
    },
  },
  partner: { name: "demo-partenaire", maxEvents: null, maxParticipantsPerEvent: null, period: "ANNUAL", price: null },
  legacy: { name: "demo-ancien-offre", maxEvents: 3, maxParticipantsPerEvent: 300, period: "MONTHLY", price: 8000, archived: true },
};

/** Champs d'affichage public d'un plan de démo (réécrits à chaque exécution). */
function publicFields(spec: PlanSpec) {
  const sheet = spec.publicSheet;
  return {
    publicVisible: sheet !== undefined,
    position: sheet?.position ?? 0,
    description: sheet?.description ?? null,
    features: sheet ? sheet.features : Prisma.DbNull,
    highlighted: sheet?.highlighted ?? false,
  };
}

/**
 * Upsert par nom des plans de démo. `update` ne touche que `archived` et les champs d'affichage public :
 * un plan existant (free, Standard) garde ses limites et son prix (seed minimal ou ajustés par le staff),
 * mais devient visible sur /tarifs en démo.
 */
export async function ensurePlans(now: Date = new Date()): Promise<PlanCatalog> {
  const createdAt = new Date(now.getTime() - 175 * DAY_MS);
  const catalog: Partial<PlanCatalog> = {};
  for (const [key, spec] of Object.entries(PLAN_SPECS) as [PlanKey, PlanSpec][]) {
    const { publicSheet: _sheet, ...columns } = spec;
    void _sheet;
    catalog[key] = await prisma.plan.upsert({
      where: { name: spec.name },
      create: { ...columns, archived: spec.archived ?? false, createdAt, ...publicFields(spec) },
      update: { archived: spec.archived ?? false, ...publicFields(spec) },
    });
  }
  return catalog as PlanCatalog;
}
