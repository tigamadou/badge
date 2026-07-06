import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export default async function StaffUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; archived?: string }>;
}) {
  const { q, type = "all", archived } = await searchParams;
  const showArchived = archived === "true";

  const where: Prisma.UserWhereInput = {
    archived: showArchived,
    ...(type === "staff" && { isStaff: true }),
    ...(type === "client" && { isStaff: false }),
    ...(q && {
      OR: [{ email: { contains: q } }, { name: { contains: q } }],
    }),
  };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      isStaff: true,
      staffRole: true,
      archived: true,
      _count: { select: { orgMemberships: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <Link
          href="/staff/users/new"
          className="rounded bg-green-600 text-white px-3 py-1.5 text-sm hover:bg-green-700"
        >
          Nouvel utilisateur
        </Link>
      </div>

      <form className="flex gap-2 items-end" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Email ou nom"
          className="flex-1 rounded border px-3 py-1.5 text-sm"
        />
        <select
          name="type"
          defaultValue={type}
          className="rounded border px-3 py-1.5 text-sm"
        >
          <option value="all">Tous</option>
          <option value="staff">Staff</option>
          <option value="client">Clients</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="archived"
            value="true"
            defaultChecked={showArchived}
          />
          Archives
        </label>
        <button type="submit" className="rounded bg-slate-800 text-white px-3 py-1.5 text-sm">
          Filtrer
        </button>
      </form>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Organisations</th>
            <th className="px-3 py-2">Statut</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                Aucun utilisateur.
              </td>
            </tr>
          )}
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="px-3 py-2">
                <Link
                  href={`/staff/users/${u.id}`}
                  className="text-green-600 hover:underline"
                >
                  {u.name}
                </Link>
              </td>
              <td className="px-3 py-2">{u.email}</td>
              <td className="px-3 py-2">
                {u.isStaff ? (
                  <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                    {u.staffRole}
                  </span>
                ) : (
                  <span className="text-slate-500 text-xs">Client</span>
                )}
              </td>
              <td className="px-3 py-2">{u._count.orgMemberships}</td>
              <td className="px-3 py-2">
                {u.archived ? (
                  <span className="text-amber-700 text-xs">Archive</span>
                ) : (
                  <span className="text-emerald-700 text-xs">Actif</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
