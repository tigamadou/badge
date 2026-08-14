import { prisma } from "@/lib/prisma";
import { BlocklistTabs } from "@/components/event/BlocklistTabs";
import { getEventOrgId } from "@/lib/event-org";

// Hote des onglets de listes de blocage (fusion v2-16 : e-mails + documents).
export default async function BlocklistPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
  const [emails, documents] = await Promise.all([
    prisma.blockedEmail.findMany({ where: { eventId }, orderBy: { createdAt: "desc" } }),
    prisma.blockedDocument.findMany({ where: { eventId }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Listes de blocage</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Empêchez certaines inscriptions par e-mail ou par pièce d&apos;identité
        </p>
      </div>
      <BlocklistTabs
        orgId={orgId}
        eventId={eventId}
        emails={emails.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
        documents={documents.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
