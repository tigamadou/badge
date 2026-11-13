import { Suspense } from "react";
import { BadgeListTable } from "@/components/event/BadgeListTable";
import { requireEventPagePermission } from "../_lib/page-access";

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { orgId } = await requireEventPagePermission(eventId, "badge.print", `/event/${eventId}/badges`);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Badges</h1>
        <p className="mt-0.5 text-sm text-slate-400">Générez et imprimez les badges des inscriptions approuvées</p>
      </div>
      <Suspense>
        <BadgeListTable orgId={orgId} eventId={eventId} />
      </Suspense>
    </div>
  );
}
