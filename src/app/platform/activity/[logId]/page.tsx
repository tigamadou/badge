import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JournalEntryDetail } from "@/components/activity/JournalEntryDetail";

export const dynamic = "force-dynamic";

export default async function StaffJournalDetailPage({ params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;

  const log = await prisma.activityLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      type: true,
      createdAt: true,
      staffActor: true,
      ipAddress: true,
      userAgent: true,
      details: true,
      orgId: true,
      eventId: true,
      targetId: true,
      user: { select: { id: true, name: true, email: true, staffRole: true } },
    },
  });
  if (!log) notFound();

  // ActivityLog ne porte pas de relation organization/event : lookups separes par id.
  const [org, event] = await Promise.all([
    log.orgId
      ? prisma.organization.findUnique({ where: { id: log.orgId }, select: { id: true, name: true, slug: true } })
      : null,
    log.eventId
      ? prisma.event.findUnique({ where: { id: log.eventId }, select: { id: true, title: true, slug: true, orgId: true } })
      : null,
  ]);

  return (
    <JournalEntryDetail
      log={log}
      org={org}
      event={event}
      backHref="/platform/activity"
      backLabel="Journal d'activité"
    />
  );
}
