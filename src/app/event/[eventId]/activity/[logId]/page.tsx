import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JournalEntryDetail } from "@/components/activity/JournalEntryDetail";
import { getEventOrgId } from "@/lib/event-org";

export const dynamic = "force-dynamic";

export default async function EventJournalDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; logId: string }>;
}) {
  const { eventId, logId } = await params;
  const orgId = await getEventOrgId(eventId);

  // Scoping : on ne montre que les entrees rattachees a cet evenement.
  const log = await prisma.activityLog.findFirst({
    where: { id: logId, eventId },
    select: {
      id: true,
      type: true,
      createdAt: true,
      staffActor: true,
      ipAddress: true,
      userAgent: true,
      details: true,
      orgId: true,
      targetId: true,
      user: { select: { id: true, name: true, email: true, staffRole: true } },
    },
  });
  if (!log) notFound();

  const [org, event] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, slug: true } }),
    prisma.event.findUnique({ where: { id: eventId }, select: { id: true, title: true, slug: true, orgId: true } }),
  ]);

  return (
    <JournalEntryDetail
      log={log}
      org={org}
      event={event}
      backHref={`/event/${eventId}/activity`}
      backLabel="Journal d'activité"
    />
  );
}
