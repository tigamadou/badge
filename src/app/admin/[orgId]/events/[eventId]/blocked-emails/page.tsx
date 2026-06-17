import { prisma } from "@/lib/prisma";
import { BlockedEmailsForm } from "@/components/event/BlockedEmailsForm";

export default async function BlockedEmailsPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const rows = await prisma.blockedEmail.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Emails bloques</h1>
      <BlockedEmailsForm
        orgId={orgId}
        eventId={eventId}
        initial={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
