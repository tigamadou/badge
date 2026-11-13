import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission } from "@/lib/permissions";
import { listAssignableRoles } from "@/lib/role-management";
import { prisma } from "@/lib/prisma";
import { MembersClient } from "./MembersClient";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const list = parseListPage(await searchParams);
  // Inviter, changer un rôle et retirer exigent `org.members.manage` ; sinon la liste reste en lecture seule.
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const orgTarget = { kind: "org", orgId } as const;
  const canManageRoles = !!ctx && hasPermission(ctx, "org.members.manage", orgTarget);
  // Ajustements de permissions : jamais pour soi, ni pour un autre propriétaire (sauf droit plateforme).
  const canAdjust = !!ctx && hasPermission(ctx, "org.members.permissions.manage", orgTarget);
  const canAdjustOwners = !!ctx && hasPermission(ctx, "users.permissions.manage", { kind: "platform" });
  const [result, ownerCount, roles] = await Promise.all([
    paginate(
      list,
      () => prisma.orgMembership.count({ where: { orgId } }),
      (range) =>
        prisma.orgMembership.findMany({
          where: { orgId },
          include: {
            user: { select: { id: true, email: true, name: true, archived: true } },
            roleRef: { select: { id: true, name: true, systemKey: true } },
          },
          orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
          ...range,
        }),
    ),
    // Le « dernier OWNER » se juge sur l'organisation entiere, pas sur la page affichee.
    prisma.orgMembership.count({
      where: { orgId, OR: [{ roleRef: { systemKey: "OWNER" } }, { roleId: null, role: "OWNER" }] },
    }),
    ctx && canManageRoles ? listAssignableRoles(ctx, { scope: "ORG", orgId }, orgTarget) : [],
  ]);

  const items = result.rows.map((m) => {
    const systemKey = m.roleRef?.systemKey ?? m.role;
    const isOwner = systemKey === "OWNER";
    const isSelf = m.userId === ctx?.user.id;
    return {
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      archived: m.user.archived,
      role: m.roleRef
        ? { id: m.roleRef.id, name: m.roleRef.name, systemKey: m.roleRef.systemKey }
        : { id: `legacy-${m.role ?? "AUDITOR"}`, name: m.role ?? "AUDITOR", systemKey: m.role ?? "AUDITOR" },
      // Ni son propre rôle, ni celui d'un autre propriétaire (sauf droit plateforme).
      roleLocked: isSelf || (isOwner && !canAdjustOwners),
      removable: canManageRoles && (isSelf || !isOwner || canAdjustOwners),
      invitedAt: m.createdAt.toISOString(),
      permissionsHref:
        canAdjust && !isSelf && (canAdjustOwners || !isOwner) ? `/org/${orgId}/members/${m.userId}/permissions` : null,
    };
  });

  return (
    <MembersClient
      orgId={orgId}
      rows={items}
      ownerCount={ownerCount}
      canManageRoles={canManageRoles}
      roles={roles}
      footer={<UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />}
    />
  );
}
