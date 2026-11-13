import { Suspense } from "react";
import { RegistrationTable } from "@/components/event/RegistrationTable";
import { requireEventPagePermission } from "../_lib/page-access";

export default async function RegistrationsListPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { orgId, permissions } = await requireEventPagePermission(
    eventId,
    "event.read.detailed",
    `/event/${eventId}/registrations`,
  );
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Inscriptions</h1>
        <p className="mt-0.5 text-sm text-slate-400">Gérez et modérez les inscriptions de l&apos;événement</p>
      </div>
      <Suspense>
        <RegistrationTable orgId={orgId} eventId={eventId} permissions={[...permissions]} />
      </Suspense>
    </div>
  );
}
