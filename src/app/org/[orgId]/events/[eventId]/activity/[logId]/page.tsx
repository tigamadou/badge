import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JournalEntryDetail } from "@/components/activity/JournalEntryDetail";

export const dynamic = "force-dynamic";

export default async function EventJournalDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string; logId: string }>;
}) {
  const { orgId, eventId, logId } = await params;

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
      backHref={`/org/${orgId}/events/${eventId}/activity`}
      backLabel="Journal d'activité"
    />
  );
}
