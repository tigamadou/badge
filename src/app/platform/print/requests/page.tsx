import type { Prisma, PrintRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RequestList, type RequestFilters } from "@/components/staff/print/RequestList";

const PAGE_SIZE = 50;
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

type Search = Partial<Record<"status" | "orgId" | "type" | "wantedFrom" | "wantedTo" | "page", string>>;

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
  const page = Math.min(100_000, Math.max(1, Math.floor(Number(sp.page)) || 1));

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

  const [rows, total, orgs] = await Promise.all([
    prisma.printRequest.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
    prisma.printRequest.count({ where }),
    prisma.organization.findMany({
      where: { printRequests: { some: { status: { not: "DRAFT" } } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Demandes d&apos;impression</h1>
        <p className="mt-0.5 text-sm text-slate-400">Devis, paiements et production des badges demandés par les organisateurs</p>
      </div>
      <RequestList
        rows={rows.map(({ _count, estimatedQuantity, ...r }) => ({
          ...r,
          // Une demande sur place n'a pas d'items : on retombe sur la quantité estimée.
          badgeCount: r.type === "ADVANCE" ? _count.items : (estimatedQuantity ?? 0),
        }))}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        filters={filters}
        orgs={orgs}
      />
    </div>
  );
}
