import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { OrganizationsTable } from "@/components/staff/OrganizationsTable";
import { Icon } from "@/components/ui/Icon";

export default async function StaffOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const { q, archived } = await searchParams;
  const showArchived = archived === "true";

  const where: Prisma.OrganizationWhereInput = {
    archived: showArchived,
    ...(q && {
      OR: [{ name: { contains: q } }, { slug: { contains: q } }],
    }),
  };

  const organizations = await prisma.organization.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      archived: true,
      _count: { select: { events: true, memberships: true } },
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Organisations</h1>
          <p className="mt-0.5 text-sm text-slate-400">Gérer les organisations de la plateforme</p>
        </div>
        <Link
          href="/platform/organizations/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <Icon name="plus" size={16} /> Créer une organisation
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 basis-full flex-1 sm:basis-auto sm:min-w-[200px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" size={16} />
          </span>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher une organisation…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-600">
          <input type="checkbox" name="archived" value="true" defaultChecked={showArchived} className="accent-green-600" />
          Afficher les archivées
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Filtrer
        </button>
      </form>

      <OrganizationsTable organizations={organizations} />
    </div>
  );
}
