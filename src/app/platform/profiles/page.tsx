import Link from "next/link";
import type { Prisma, ProfileStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { TableFrame } from "@/components/ui/TableFrame";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

const TABS: Array<{ value: ProfileStatus; label: string }> = [
  { value: "PENDING", label: "En attente" },
  { value: "REJECTED", label: "Rejetés" },
  { value: "APPROVED", label: "Validés" },
];

export default async function PlatformProfilesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "PENDING";
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const list = parseListPage(sp);
  const activeStatus = (TABS.find((t) => t.value === status)?.value ?? "PENDING") as ProfileStatus;

  const where: Prisma.UserWhereInput = {
    isStaff: false,
    profileStatus: activeStatus,
    ...(q && {
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
        { idDocumentNumber: { contains: q } },
      ],
    }),
  };

  const result = await paginate(
    list,
    () => prisma.user.count({ where }),
    (range) =>
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...range,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          structure: true,
          profileStatus: true,
          idDocumentType: true,
          idDocumentNumber: true,
        },
      }),
  );
  const users = result.rows;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Profils participants</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Validation des documents d&apos;identité par la plateforme
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/platform/profiles?status=${t.value}${q ? `&q=${encodeURIComponent(q)}` : ""}&pageSize=${result.pageSize}`}
            className={`rounded-lg px-3.5 py-2 text-[13px] font-medium ${
              activeStatus === t.value
                ? "bg-navy text-white"
                : "bg-mist text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2.5">
        <input type="hidden" name="status" value={activeStatus} />
        <input type="hidden" name="pageSize" value={result.pageSize} />
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" size={16} />
          </span>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher (nom, e-mail, numéro de pièce)…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
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
            <tr className="bg-mist text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Pièce</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  Aucun profil dans cet état.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-mist">
                <td className="px-4 py-3">
                  <Link
                    href={`/platform/profiles/${u.id}`}
                    className="text-sm font-medium text-slate-900 hover:text-navy"
                  >
                    {u.firstName} {u.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-500">{u.email}</td>
                <td className="px-4 py-3 text-[13px] text-slate-500">
                  {u.idDocumentType} — {u.idDocumentNumber}
                </td>
                <td className="px-4 py-3">
                  {/* activeStatus est contraint a PENDING/REJECTED/APPROVED par les onglets. */}
                  <StatusBadge status={u.profileStatus as "PENDING" | "APPROVED" | "REJECTED"} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/platform/profiles/${u.id}`}
                    aria-label={`Ouvrir ${u.firstName} ${u.lastName}`}
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
