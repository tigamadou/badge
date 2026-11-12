import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasOrgRole } from "@/lib/auth-helpers";
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
  // Le changement de role est OWNER-only : sinon le role reste en lecture seule.
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const canManageRoles = ctx ? hasOrgRole(ctx, orgId, "OWNER") : false;
  const [result, ownerCount] = await Promise.all([
    paginate(
      list,
      () => prisma.orgMembership.count({ where: { orgId } }),
      (range) =>
        prisma.orgMembership.findMany({
          where: { orgId },
          include: { user: { select: { id: true, email: true, name: true, archived: true } } },
          orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
          ...range,
        }),
    ),
    // Le « dernier OWNER » se juge sur l'organisation entiere, pas sur la page affichee.
    prisma.orgMembership.count({ where: { orgId, role: "OWNER" } }),
  ]);

  const items = result.rows.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    archived: m.user.archived,
    role: m.role ?? "AUDITOR",
    invitedAt: m.createdAt.toISOString(),
  }));

  return (
    <MembersClient
      orgId={orgId}
      rows={items}
      ownerCount={ownerCount}
      canManageRoles={canManageRoles}
      footer={<UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />}
    />
  );
}
