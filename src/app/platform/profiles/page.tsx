import Link from "next/link";
import type { Prisma, ProfileStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";

const TABS: Array<{ value: ProfileStatus; label: string }> = [
  { value: "PENDING", label: "En attente" },
  { value: "REJECTED", label: "Rejetés" },
  { value: "APPROVED", label: "Validés" },
];

export default async function PlatformProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "PENDING", q } = await searchParams;
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

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
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
  });

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
            href={`/platform/profiles?status=${t.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-lg px-3.5 py-2 text-[13px] font-medium ${
              activeStatus === t.value
                ? "bg-green-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2.5">
        <input type="hidden" name="status" value={activeStatus} />
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
          className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Filtrer
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/platform/profiles/${u.id}`}
                    className="text-sm font-medium text-slate-900 hover:text-green-600"
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
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Icon name="chevron-right" size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
