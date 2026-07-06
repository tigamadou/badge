import { RegistrationTable } from "@/components/event/RegistrationTable";

export default async function RegistrationsListPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
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
