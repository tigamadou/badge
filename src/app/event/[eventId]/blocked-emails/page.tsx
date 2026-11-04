import { prisma } from "@/lib/prisma";
import { BlocklistTabs } from "@/components/event/BlocklistTabs";
import { getEventOrgId } from "@/lib/event-org";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

// Hote des onglets de listes de blocage (fusion v2-16 : e-mails + documents).
export default async function BlocklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  const tab = query.tab === "documents" ? "documents" : "emails";
  const list = parseListPage(query);
  const orgId = await getEventOrgId(eventId);
  // Seule la liste de l'onglet actif est lue et paginee ; l'autre n'est que comptee (pastille).
  const [emailTotal, documentTotal] = await Promise.all([
    prisma.blockedEmail.count({ where: { eventId } }),
    prisma.blockedDocument.count({ where: { eventId } }),
  ]);
  const emailPage =
    tab === "emails"
      ? await paginate(
          list,
          async () => emailTotal,
          (range) =>
            prisma.blockedEmail.findMany({
              where: { eventId },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              ...range,
            }),
        )
      : null;
  const documentPage =
    tab === "documents"
      ? await paginate(
          list,
          async () => documentTotal,
          (range) =>
            prisma.blockedDocument.findMany({
              where: { eventId },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              ...range,
            }),
        )
      : null;
  const active = emailPage ?? documentPage!;

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
        tab={tab}
        emailTotal={emailTotal}
        documentTotal={documentTotal}
        emails={(emailPage?.rows ?? []).map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
        documents={(documentPage?.rows ?? []).map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
        footer={
          <UrlPagination page={active.page} totalPages={active.totalPages} total={active.total} pageSize={active.pageSize} />
        }
      />
    </div>
  );
}
