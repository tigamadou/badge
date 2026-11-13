import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { RoleBadge, Tag } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";
import { TableFrame } from "@/components/ui/TableFrame";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

function initials(name: string | null): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function StaffUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const type = typeof sp.type === "string" ? sp.type : "all";
  const archived = typeof sp.archived === "string" ? sp.archived : undefined;
  const list = parseListPage(sp);
  const showArchived = archived === "true";

  const where: Prisma.UserWhereInput = {
    archived: showArchived,
    ...(type === "staff" && { isStaff: true }),
    ...(type === "client" && { isStaff: false }),
    ...(q && {
      OR: [{ email: { contains: q } }, { name: { contains: q } }],
    }),
  };

  const result = await paginate(
    list,
    () => prisma.user.count({ where }),
    (range) =>
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          isStaff: true,
          staffRole: true,
          platformRole: { select: { name: true } },
          archived: true,
          _count: { select: { orgMemberships: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...range,
      }),
  );
  const users = result.rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-navy">Utilisateurs</h1>
          <p className="mt-0.5 text-sm text-slate-400">Comptes staff et clients de la plateforme</p>
        </div>
        <Link
          href="/platform/users/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-sm font-medium text-white hover:bg-navy-hover"
        >
          <Icon name="plus" size={16} /> Créer un utilisateur
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2.5">
        <input type="hidden" name="pageSize" value={result.pageSize} />
        <div className="relative min-w-0 basis-full flex-1 sm:basis-auto sm:min-w-[200px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" size={16} />
          </span>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher un utilisateur…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <select
          name="type"
          defaultValue={type}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700"
        >
          <option value="all">Tous</option>
          <option value="staff">Staff</option>
          <option value="client">Clients</option>
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-600">
          <input type="checkbox" name="archived" value="true" defaultChecked={showArchived} className="accent-navy" />
          Archivés
        </label>
        <button
          type="submit"
          className="rounded-lg bg-mist px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Filtrer
        </button>
      </form>

      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-left text-[11px] font-semibold uppercase tracking-wider text-white">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3 hidden md:table-cell">E-mail</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 hidden md:table-cell">Organisations</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  Aucun utilisateur.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr
                key={u.id}
                className={`border-t border-slate-100 hover:bg-mist ${u.archived ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                      {initials(u.name)}
                    </span>
                    <Link
                      href={`/platform/users/${u.id}`}
                      className="text-sm font-medium text-slate-900 hover:text-navy"
                    >
                      {u.name}
                    </Link>
                    {u.archived && <Tag icon="archive">Archivé</Tag>}
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-500 hidden md:table-cell">{u.email}</td>
                <td className="px-4 py-3">
                  {u.isStaff ? (
                    <RoleBadge tone="navy">{u.platformRole?.name ?? u.staffRole}</RoleBadge>
                  ) : (
                    <RoleBadge tone="slate">Client</RoleBadge>
                  )}
                </td>
                <td className="px-4 py-3 text-sm tabular-nums text-slate-600 hidden md:table-cell">{u._count.orgMemberships}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/platform/users/${u.id}`}
                    aria-label={`Ouvrir ${u.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-mist hover:text-slate-600"
                  >
                    <Icon name="chevron-right" size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
      <UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />
    </div>
  );
}
