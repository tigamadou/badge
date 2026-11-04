import { prisma } from "@/lib/prisma";
import { PlanManager, type PlanRow } from "@/components/staff/PlanManager";

export default async function PlatformPlansPage() {
  const plans = await prisma.plan.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });

  const rows: PlanRow[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    period: p.period,
    maxEvents: p.maxEvents,
    maxParticipantsPerEvent: p.maxParticipantsPerEvent,
    price: p.price,
    archived: p.archived,
    subscriptionsCount: p._count.subscriptions,
    publicVisible: p.publicVisible,
    position: p.position,
    description: p.description,
    // Json libre en base : tout ce qui n'est pas une liste de textes est ignoré.
    features: Array.isArray(p.features) ? p.features.filter((f): f is string => typeof f === "string") : [],
    highlighted: p.highlighted,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Plans</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Catalogue des plans d&apos;abonnement (limites d&apos;events et de participants par event)
        </p>
      </div>
      <PlanManager plans={rows} />
    </div>
  );
}
