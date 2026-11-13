import { notFound } from "next/navigation";
import { requireOrgPagePermission } from "@/app/org/[orgId]/_lib/page-access";
import { prisma } from "@/lib/prisma";
import { JournalEntryDetail } from "@/components/activity/JournalEntryDetail";

export const dynamic = "force-dynamic";

export default async function OrgJournalDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; logId: string }>;
}) {
  const { orgId, logId } = await params;
  await requireOrgPagePermission(orgId, "org.activity.read", `/org/${orgId}/activity/${logId}`);

  // Scoping : on ne montre que les entrees rattachees a cette organisation.
  const log = await prisma.activityLog.findFirst({
    where: { id: logId, orgId },
    select: {
      id: true,
      type: true,
      createdAt: true,
      staffActor: true,
      ipAddress: true,
      userAgent: true,
      details: true,
      eventId: true,
      targetId: true,
      user: { select: { id: true, name: true, email: true, staffRole: true } },
    },
  });
  if (!log) notFound();

  const [org, event] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, slug: true } }),
    log.eventId
      ? prisma.event.findUnique({ where: { id: log.eventId }, select: { id: true, title: true, slug: true, orgId: true } })
      : null,
  ]);

  return (
    <JournalEntryDetail
      log={log}
      org={org}
      event={event}
      backHref={`/org/${orgId}/activity`}
      backLabel="Journal d'activité"
    />
  );
}
