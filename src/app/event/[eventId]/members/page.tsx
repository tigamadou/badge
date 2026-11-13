import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { eventTargetOf, hasPermission } from "@/lib/permissions";
import { listAssignableRoles } from "@/lib/role-management";
import { MemberTable } from "@/components/event/MemberTable";
import { getEventOrgId } from "@/lib/event-org";
import { requireEventPagePermission } from "../_lib/page-access";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  await requireEventPagePermission(eventId, "event.members.manage", `/event/${eventId}/members`);
  const list = parseListPage(await searchParams);
  const orgId = await getEventOrgId(eventId);
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const target = eventTargetOf({ eventId, orgId });
  // Le rôle se modifie, et on invite ou retire, avec `event.members.manage` ; sinon lecture seule.
  const canManage = !!ctx && hasPermission(ctx, "event.members.manage", target);
  const [result, roles] = await Promise.all([
    paginate(
      list,
      () => prisma.eventMembership.count({ where: { eventId } }),
      (range) =>
        prisma.eventMembership.findMany({
          where: { eventId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...range,
          select: {
            id: true,
            role: true,
            roleRef: { select: { id: true, name: true, systemKey: true } },
            createdAt: true,
            user: { select: { id: true, email: true, name: true, isStaff: true } },
          },
        }),
    ),
    ctx && canManage ? listAssignableRoles(ctx, { scope: "EVENT", orgId }, target) : [],
  ]);
  const serialised = result.rows.map(({ roleRef, role, ...m }) => ({
    ...m,
    role: roleRef
      ? { id: roleRef.id, name: roleRef.name, systemKey: roleRef.systemKey }
      : { id: `legacy-${role ?? "VIEWER"}`, name: role ?? "VIEWER", systemKey: role ?? "VIEWER" },
    createdAt: m.createdAt.toISOString(),
  }));
  return (
    <MemberTable
      orgId={orgId}
      eventId={eventId}
      rows={serialised}
      roles={roles}
      canManage={canManage}
      footer={<UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />}
    />
  );
}
