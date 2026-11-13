import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JournalEntryDetail } from "@/components/activity/JournalEntryDetail";
import { requireEventPagePermission } from "../../_lib/page-access";

export const dynamic = "force-dynamic";

export default async function EventJournalDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; logId: string }>;
}) {
  const { eventId, logId } = await params;
  const { ctx, orgId, permissions } = await requireEventPagePermission(
    eventId,
    ["event.activity.read", "scan.history.read"],
    `/event/${eventId}/activity/${logId}`,
  );

  // Scoping : on ne montre que les entrees rattachees a cet evenement ; sans journal complet, les siennes seulement.
  const log = await prisma.activityLog.findFirst({
    where: {
      id: logId,
      eventId,
      ...(permissions.has("event.activity.read") ? {} : { userId: ctx.user.id, type: "BADGE_SCANNED" as const }),
    },
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
