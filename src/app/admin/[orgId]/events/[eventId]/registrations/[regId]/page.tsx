import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RegistrationDetailPanel } from "@/components/event/RegistrationDetailPanel";
import { RegistrationHistory } from "@/components/event/RegistrationHistory";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string; regId: string }>;
}) {
  const { orgId, eventId, regId } = await params;
  const registration = await prisma.registration.findUnique({
    where: { id: regId },
    include: {
      category: true,
      snapshots: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!registration || registration.eventId !== eventId) notFound();

  const r = {
    id: registration.id,
    firstName: registration.firstName,
    lastName: registration.lastName,
    email: registration.email,
    structure: registration.structure,
    status: registration.status,
    badgePrinted: registration.badgePrinted,
    badgePrintedAt: registration.badgePrintedAt?.toISOString() ?? null,
    allAccessGranted: registration.allAccessGranted,
    rejectionReason: registration.rejectionReason,
    rejectionDetails: registration.rejectionDetails,
    photo: registration.photo,
    idDocument: registration.idDocument,
    idDocumentType: registration.idDocumentType,
    idDocumentNumber: registration.idDocumentNumber,
    createdAt: registration.createdAt.toISOString(),
    category: registration.category,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <RegistrationDetailPanel orgId={orgId} eventId={eventId} registration={r} />
      <section>
        <h3 className="text-lg font-semibold mb-3">Historique des modifications</h3>
        <RegistrationHistory
          snapshots={registration.snapshots.map((s) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            email: s.email,
            structure: s.structure,
            idDocumentNumber: s.idDocumentNumber,
            createdAt: s.createdAt.toISOString(),
          }))}
        />
      </section>
    </div>
  );
}
