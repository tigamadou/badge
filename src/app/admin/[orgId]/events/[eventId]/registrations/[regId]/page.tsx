import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RegistrationDetailPanel } from "@/components/event/RegistrationDetailPanel";

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
    },
  });
  if (!registration || registration.eventId !== eventId) notFound();

  const r = {
    id: registration.id,
    firstName: registration.snapshotFirstName,
    lastName: registration.snapshotLastName,
    email: registration.snapshotEmail,
    structure: registration.snapshotStructure,
    status: registration.status,
    badgePrinted: registration.badgePrinted,
    badgePrintedAt: registration.badgePrintedAt?.toISOString() ?? null,
    allAccessGranted: registration.allAccessGranted,
    rejectionReason: registration.rejectionReason,
    rejectionDetails: registration.rejectionDetails,
    photo: registration.snapshotPhoto,
    idDocument: registration.snapshotIdDocument,
    idDocumentType: registration.snapshotIdDocumentType,
    idDocumentNumber: registration.snapshotIdDocumentNumber,
    createdAt: registration.createdAt.toISOString(),
    category: registration.category,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <RegistrationDetailPanel orgId={orgId} eventId={eventId} registration={r} />
    </div>
  );
}
