import { prisma } from "@/lib/prisma";
import { BlockedDocumentsForm } from "@/components/event/BlockedDocumentsForm";

export default async function BlockedDocumentsPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const rows = await prisma.blockedDocument.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Documents bloques</h1>
      <BlockedDocumentsForm
        orgId={orgId}
        eventId={eventId}
        initial={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
