import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateQRCodeDataURL } from "@/lib/qrcode";
import { BadgeDownloadV2 } from "@/components/badge/BadgeDownloadV2";

export default async function BadgeDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string; badgeId: string }>;
}) {
  const { orgId, eventId, badgeId } = await params;
  const registration = await prisma.registration.findUnique({
    where: { id: badgeId },
    include: {
      category: true,
      event: { select: { title: true, date: true, logo: true, orgId: true } },
    },
  });
  if (!registration || registration.eventId !== eventId || registration.event.orgId !== orgId) {
    notFound();
  }

  const baseUrl = process.env.BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const qrDataUrl = await generateQRCodeDataURL(`${baseUrl}/verify/${registration.id}`);

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">
        Badge — {registration.snapshotFirstName} {registration.snapshotLastName}
      </h1>
      <BadgeDownloadV2
        registration={{
          id: registration.id,
          firstName: registration.snapshotFirstName,
          lastName: registration.snapshotLastName,
          structure: registration.snapshotStructure,
          photo: registration.snapshotPhoto,
          allAccessGranted: registration.allAccessGranted,
          category: {
            name: registration.category.name,
            color: registration.category.color,
            number: registration.category.number,
            neutralBadge: registration.category.neutralBadge,
            anonymous: registration.category.anonymous,
          },
        }}
        event={{
          title: registration.event.title,
          date: registration.event.date,
          logo: registration.event.logo,
        }}
        qrDataUrl={qrDataUrl}
      />
    </div>
  );
}
