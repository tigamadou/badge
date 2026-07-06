import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { UserDetailActions } from "./UserDetailActions";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const canAdmin =
    !!ctx && ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN");
  const canEditTopRoles = ctx?.staffRole === "SUPER_ADMIN";
  const canResetPassword =
    !!ctx && ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_SUPPORT");
  const isSelf = ctx?.user.id === userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isStaff: true,
      staffRole: true,
      archived: true,
      archivedAt: true,
      createdAt: true,
      orgMemberships: {
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true, archived: true } },
        },
      },
      eventMemberships: {
        select: {
          role: true,
          event: { select: { id: true, title: true, slug: true, orgId: true } },
        },
      },
    },
  });
  if (!user) notFound();

  const recentActivity = await prisma.activityLog.findMany({
    where: { OR: [{ userId }, { targetId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, createdAt: true, staffActor: true, orgId: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <div className="text-sm text-slate-500">{user.email}</div>
        <div className="mt-1 flex gap-2 text-xs">
          {user.isStaff && user.staffRole && (
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">
              {user.staffRole}
            </span>
          )}
          {user.archived && (
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800">Archive</span>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2 text-sm">
          Organisations ({user.orgMemberships.length})
        </h2>
        <ul className="bg-white border rounded divide-y text-sm">
          {user.orgMemberships.length === 0 && (
            <li className="px-3 py-2 text-slate-500">Aucune appartenance org.</li>
          )}
          {user.orgMemberships.map((m) => (
            <li
              key={m.organization.id}
              className="px-3 py-2 flex justify-between"
            >
              <span>
                {m.organization.name}
                {m.organization.archived && (
                  <span className="ml-2 text-amber-700 text-xs">(archive)</span>
                )}
              </span>
              <span className="text-slate-500">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2 text-sm">
          Evenements ({user.eventMemberships.length})
        </h2>
        <ul className="bg-white border rounded divide-y text-sm">
          {user.eventMemberships.length === 0 && (
            <li className="px-3 py-2 text-slate-500">Aucune appartenance event.</li>
          )}
          {user.eventMemberships.map((m) => (
            <li key={m.event.id} className="px-3 py-2 flex justify-between">
              <span>{m.event.title}</span>
              <span className="text-slate-500">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <UserDetailActions
        user={{
          id: user.id,
          isStaff: user.isStaff,
          staffRole: user.staffRole,
          archived: user.archived,
        }}
        canAdmin={canAdmin}
        canEditTopRoles={canEditTopRoles}
        canResetPassword={canResetPassword}
        isSelf={isSelf}
      />

      <section>
        <h2 className="text-lg font-semibold mb-2">Journal recent</h2>
        <ul className="bg-white border rounded divide-y text-sm">
          {recentActivity.length === 0 && (
            <li className="px-3 py-2 text-slate-500">Aucune activite.</li>
          )}
          {recentActivity.map((a) => (
            <li key={a.id} className="px-3 py-2 flex justify-between">
              <span>
                {a.type}
                {a.staffActor && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                    staff
                  </span>
                )}
              </span>
              <span className="text-slate-500 text-xs">
                {new Date(a.createdAt).toLocaleString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div>
        <Link
          href="/staff/users"
          className="text-sm text-green-600 hover:underline"
        >
          Retour a la liste
        </Link>
      </div>
    </div>
  );
}
