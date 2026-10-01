import { BadgeListTable } from "@/components/event/BadgeListTable";
import { getEventOrgId } from "@/lib/event-org";

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Badges</h1>
        <p className="mt-0.5 text-sm text-slate-400">Générez et imprimez les badges des inscriptions approuvées</p>
      </div>
      <BadgeListTable orgId={orgId} eventId={eventId} />
    </div>
  );
}
