import { RegistrationTable } from "@/components/event/RegistrationTable";
import { getEventOrgId } from "@/lib/event-org";

export default async function RegistrationsListPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Inscriptions</h1>
        <p className="mt-0.5 text-sm text-slate-400">Gérez et modérez les inscriptions de l&apos;événement</p>
      </div>
      <RegistrationTable orgId={orgId} eventId={eventId} />
    </div>
  );
}
