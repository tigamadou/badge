import { prisma } from "@/lib/prisma";
import { RegistrationForm } from "@/components/event/RegistrationForm";
import { requireEventPagePermission } from "../../_lib/page-access";

export default async function NewRegistrationPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { orgId } = await requireEventPagePermission(
    eventId,
    "registration.create",
    `/event/${eventId}/registrations/new`,
  );
  const categories = await prisma.category.findMany({
    where: { eventId },
    orderBy: { number: "asc" },
    select: { id: true, name: true, number: true },
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Inscription manuelle</h1>
        <p className="mt-0.5 text-sm text-slate-400">Créer une inscription directement</p>
      </div>
      <RegistrationForm orgId={orgId} eventId={eventId} categories={categories} />
    </div>
  );
}
