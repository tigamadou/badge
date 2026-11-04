import { unstable_noStore as noStore } from "next/cache";
import type { SubscriptionPeriod } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PublicPlan = {
  id: string;
  name: string;
  period: SubscriptionPeriod;
  price: number | null;
  maxEvents: number | null;
  maxParticipantsPerEvent: number | null;
  description: string | null;
  features: string[];
  highlighted: boolean;
};

// Json libre en base : seuls les libellés texte non vides sont retenus.
function normalizeFeatures(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is string => typeof f === "string" && f.trim() !== "").map((f) => f.trim());
}

// Plans affichés sur /tarifs et sur l'accueil. noStore() : la lecture se fait à chaque requête
// (pages dynamiques), jamais au `next build` et sans cache à invalider quand le staff édite un plan.
export async function listPublicPlans(): Promise<PublicPlan[]> {
  noStore();
  const rows = await prisma.plan.findMany({
    where: { publicVisible: true, archived: false },
    orderBy: [{ position: "asc" }, { price: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      period: true,
      price: true,
      maxEvents: true,
      maxParticipantsPerEvent: true,
      description: true,
      features: true,
      highlighted: true,
    },
  });
  return rows.map((p) => ({ ...p, features: normalizeFeatures(p.features) }));
}
