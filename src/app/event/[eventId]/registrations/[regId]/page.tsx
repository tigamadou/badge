import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { RegistrationDetailPanel } from "@/components/event/RegistrationDetailPanel";
import { Icon } from "@/components/ui/Icon";
import { getEventOrgId } from "@/lib/event-org";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; regId: string }>;
}) {
  const { eventId, regId } = await params;
  const orgId = await getEventOrgId(eventId);
  const registration = await prisma.registration.findUnique({
    where: { id: regId },
    include: {
      category: true,
      user: { select: { profileStatus: true } },
    },
  });
  if (!registration || registration.eventId !== eventId) notFound();

  // Meme regle que /api/files : un document de profil n'est lisible que par le staff
  // plateforme. Un membre d'organisation voit un etat, pas le fichier.
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const idDocumentReadable = Boolean(ctx?.isStaff);

  // v4 (plan 08) : date de validation plateforme (derniere soumission approuvee).
  const approvedSubmission = await prisma.profileSubmission.findFirst({
    where: { userId: registration.userId, status: "APPROVED" },
    orderBy: { reviewedAt: "desc" },
    select: { reviewedAt: true },
  });

  // v4 (plan 08) : le rejet d'inscription puise dans le catalogue plateforme (portee
  // REGISTRATION ou BOTH). L'endpoint /api/platform/rejection-reasons etant reserve
  // au staff, on descend la liste depuis ce Server Component.
  const rejectionReasons = await prisma.rejectionReason.findMany({
    where: { archived: false, scope: { in: ["REGISTRATION", "BOTH"] } },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true },
  });

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
    idDocumentReadable,
    profileStatus: registration.user.profileStatus,
    profileReviewedAt: approvedSubmission?.reviewedAt?.toISOString() ?? null,
    idDocumentType: registration.snapshotIdDocumentType,
    idDocumentNumber: registration.snapshotIdDocumentNumber,
    createdAt: registration.createdAt.toISOString(),
    category: registration.category,
  };

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href={`/event/${eventId}/registrations`}
        className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600"
      >
        <Icon name="arrow-left" size={13} /> Inscriptions
      </Link>
      <RegistrationDetailPanel
        orgId={orgId}
        eventId={eventId}
        registration={r}
        rejectionReasons={rejectionReasons}
      />
    </div>
  );
}
