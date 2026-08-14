import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateQRCodeDataURL } from "@/lib/qrcode";
import { formatEventDate } from "@/lib/format-date";
import { BadgeDownloadV2 } from "@/components/badge/BadgeDownloadV2";
import { BadgeCard } from "@/components/badge/BadgeCard";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { CatPill } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";
import { getEventOrgId } from "@/lib/event-org";

export default async function BadgeDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; badgeId: string }>;
}) {
  const { eventId, badgeId } = await params;
  const orgId = await getEventOrgId(eventId);
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

  const anonymous = registration.category.anonymous;
  const displayName = anonymous
    ? "Identité masquée"
    : `${registration.snapshotFirstName} ${registration.snapshotLastName}`;

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href={`/event/${eventId}/badges`}
        className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600"
      >
        <Icon name="arrow-left" size={13} /> Badges
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[257px_1fr]">
        <div>
          <BadgeCard
            org={registration.event.title}
            name={displayName}
            role={anonymous ? undefined : registration.snapshotStructure}
            category={registration.category.name}
            categoryColor={registration.category.neutralBadge ? "#334155" : registration.category.color}
            qr={
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR code du badge" className="h-full w-full" />
            }
            meta={
              <>
                N° {registration.id}
                <br />
                {formatEventDate(registration.event.date)}
              </>
            }
            allAccess={registration.allAccessGranted}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHead title="Informations" />
            <CardBody>
              <KeyValue
                items={[
                  {
                    label: "Catégorie",
                    value: <CatPill color={registration.category.color} label={registration.category.name} />,
                  },
                  { label: "Statut du badge", value: registration.badgePrinted ? "Imprimé" : "Non imprimé" },
                  { label: "ALL ACCESS", value: registration.allAccessGranted ? "Oui" : "Non" },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Actions" />
            <CardBody className="space-y-3">
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
              <Link
                href={`/event/${eventId}/registrations/${registration.id}`}
                className="inline-flex text-[13px] font-medium text-green-600 hover:underline"
              >
                Voir l&apos;inscription
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
