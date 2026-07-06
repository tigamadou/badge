import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { OrganizationsTable } from "@/components/staff/OrganizationsTable";

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Organisations</h1>
        <Link
          href="/staff/organizations/new"
          className="rounded bg-green-600 text-white px-3 py-1.5 text-sm hover:bg-green-700"
        >
          Nouvelle organisation
        </Link>
      </div>

      <form className="flex gap-2" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher par nom ou slug"
          className="flex-1 rounded border px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="true" defaultChecked={showArchived} />
          Archivees
        </label>
        <button type="submit" className="rounded bg-slate-800 text-white px-3 py-1.5 text-sm">
          Filtrer
        </button>
      </form>

      <OrganizationsTable organizations={organizations} />
    </div>
  );
}
