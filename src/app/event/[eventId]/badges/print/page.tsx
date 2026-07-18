import { BadgeBatchPanel } from "@/components/event/BadgeBatchPanel";
import { getEventOrgId } from "@/lib/event-org";

export default async function BatchPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ ids?: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
  const { ids: idsParam } = await searchParams;
  const ids = (idsParam ?? "").split(",").filter(Boolean);
  const baseUrl = process.env.BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Impression par lot</h1>
        <p className="mt-0.5 text-sm text-slate-400">{ids.length} badge(s) à générer</p>
      </div>
      <BadgeBatchPanel orgId={orgId} eventId={eventId} ids={ids} baseUrl={baseUrl} />
    </div>
  );
}
