import { RegistrationTable } from "@/components/event/RegistrationTable";

export default async function RegistrationsListPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inscriptions</h1>
      <RegistrationTable orgId={orgId} eventId={eventId} />
    </div>
  );
}
