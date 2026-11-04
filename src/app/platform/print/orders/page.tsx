import type { Prisma, PrintRequestStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unreadByRequest } from "@/lib/print-requests/read-state";
import { RequestList, type RequestFilters } from "@/components/staff/print/RequestList";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

const STATUSES = [
  "SUBMITTED",
  "QUOTED",
  "ACCEPTED",
  "PAID",
  "IN_PRODUCTION",
  "READY",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;
const DAY_MS = 86_400_000;

type Search = Partial<Record<"status" | "orgId" | "type" | "wantedFrom" | "wantedTo" | "page" | "pageSize", string>>;

const isDay = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export default async function PrintRequestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const filters: RequestFilters = {
    status: (STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "",
    orgId: sp.orgId ?? "",
    type: sp.type === "ADVANCE" || sp.type === "ONSITE" ? sp.type : "",
    wantedFrom: isDay(sp.wantedFrom) ? sp.wantedFrom : "",
    wantedTo: isDay(sp.wantedTo) ? sp.wantedTo : "",
  };
  const list = parseListPage(sp);

  const wantedBy: Prisma.DateTimeNullableFilter = {};
  if (filters.wantedFrom) wantedBy.gte = new Date(`${filters.wantedFrom}T00:00:00Z`);
  // Borne haute incluse : toute la journée demandée.
  if (filters.wantedTo) wantedBy.lt = new Date(new Date(`${filters.wantedTo}T00:00:00Z`).getTime() + DAY_MS);
  const where: Prisma.PrintRequestWhereInput = {
    status: filters.status ? (filters.status as PrintRequestStatus) : { not: "DRAFT" },
    ...(filters.orgId ? { orgId: filters.orgId } : {}),
    ...(filters.type ? { type: filters.type as "ADVANCE" | "ONSITE" } : {}),
    ...(filters.wantedFrom || filters.wantedTo ? { wantedBy } : {}),
  };

  const [result, orgs] = await Promise.all([
    paginate(
      list,
      () => prisma.printRequest.count({ where }),
      (range) =>
        prisma.printRequest.findMany({
          where,
          orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
          ...range,
          select: {
            id: true,
            reference: true,
            type: true,
            status: true,
            wantedBy: true,
            estimatedQuantity: true,
            total: true,
            event: { select: { id: true, title: true } },
            org: { select: { id: true, name: true } },
            _count: { select: { items: true } },
          },
        }),
    ),
    prisma.organization.findMany({
      where: { printRequests: { some: { status: { not: "DRAFT" } } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const rows = result.rows;

  // Le layout /platform garantit une session staff ; la garde sert le typage.
  const session = await getServerSession(authOptions);
  const unread = session?.user?.id
    ? await unreadByRequest(session.user.id, "STAFF", rows.map((r) => r.id))
    : {};

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Commandes d&apos;impression</h1>
        <p className="mt-0.5 text-sm text-slate-400">Devis, paiements et production des badges demandés par les organisateurs</p>
      </div>
      <RequestList
        rows={rows.map(({ _count, estimatedQuantity, ...r }) => ({
          ...r,
          // Une commande sur place n'a pas d'items : on retombe sur la quantité estimée.
          badgeCount: r.type === "ADVANCE" ? _count.items : (estimatedQuantity ?? 0),
          unread: unread[r.id] ?? 0,
        }))}
        pagination={<UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />}
        pageSize={result.pageSize}
        total={result.total}
        filters={filters}
        orgs={orgs}
      />
    </div>
  );
}
