import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui/Icon";
import { ProfileReviewPanel } from "@/components/staff/ProfileReviewPanel";

export default async function PlatformProfileDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      structure: true,
      profileStatus: true,
      photo: true,
      idDocumentType: true,
      idDocumentNumber: true,
      idDocument: true,
      isStaff: true,
    },
  });
  if (!user || user.isStaff) notFound();

  // v4 (plan 08) : la decision est reservee STAFF_SUPPORT et au-dessus.
  const session = await getServerSession(authOptions);
  const me = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { staffRole: true } })
    : null;
  const canDecide =
    me?.staffRole === "SUPER_ADMIN" || me?.staffRole === "STAFF_ADMIN" || me?.staffRole === "STAFF_SUPPORT";

  const submissions = await prisma.profileSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      photo: true,
      idDocumentType: true,
      idDocumentNumber: true,
      idDocument: true,
      status: true,
      rejectionReasonLabel: true,
      rejectionDetails: true,
      reviewedAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/platform/profiles"
        className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600"
      >
        <Icon name="arrow-left" size={13} /> Profils
      </Link>
      <ProfileReviewPanel
        canDecide={canDecide}
        user={{
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          structure: user.structure,
          profileStatus: user.profileStatus,
          photo: user.photo,
          idDocument: user.idDocument,
          idDocumentType: user.idDocumentType,
          idDocumentNumber: user.idDocumentNumber,
        }}
        submissions={submissions.map((s) => ({
          id: s.id,
          status: s.status,
          rejectionReasonLabel: s.rejectionReasonLabel,
          rejectionDetails: s.rejectionDetails,
          reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
