import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasEventPermission } from "@/lib/auth-helpers";
import { loadUserContext } from "@/lib/user-context";
import { prisma } from "@/lib/prisma";
import { BadgePrintActions } from "@/components/badge/BadgePrintActions";
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/event/${eventId}/badges/${badgeId}`);
  }
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");
  // Garde avant toute lecture d'inscription : le layout de l'evenement laisse passer tout role.
  if (!hasEventPermission(ctx, eventId, orgId, "badge.print")) {
    redirect(`/event/${eventId}`);
  }
  const registration = await prisma.registration.findUnique({
    where: { id: badgeId },
    include: {
      category: true,
      event: { select: { orgId: true, archived: true } },
    },
  });
  if (!registration || registration.eventId !== eventId || registration.event.orgId !== orgId) {
    notFound();
  }

  const anonymous = registration.category.anonymous;

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        href={`/event/${eventId}/badges`}
        className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600"
      >
        <Icon name="arrow-left" size={13} /> Badges
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <BadgePrintActions
          orgId={orgId}
          eventId={eventId}
          registrationId={registration.id}
          approved={registration.status === "APPROVED"}
          archived={registration.event.archived}
          printed={registration.badgePrinted}
          printedAt={registration.badgePrintedAt?.toISOString() ?? null}
        />

        <Card>
          <CardHead title="Informations" />
          <CardBody className="space-y-3">
            <KeyValue
              items={[
                { label: "N°", value: registration.id },
                {
                  label: "Nom",
                  value: anonymous
                    ? "Identité masquée"
                    : `${registration.snapshotFirstName} ${registration.snapshotLastName}`,
                },
                {
                  label: "Catégorie",
                  value: <CatPill color={registration.category.color} label={registration.category.name} />,
                },
                { label: "ALL ACCESS", value: registration.allAccessGranted ? "Oui" : "Non" },
              ]}
            />
            <Link
              href={`/event/${eventId}/registrations/${registration.id}`}
              className="inline-flex text-[13px] font-medium text-navy hover:underline"
            >
              Voir l&apos;inscription
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
