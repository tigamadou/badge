import { requirePlatformPage } from "@/app/platform/page-guard";
import { prisma } from "@/lib/prisma";
import { PlatformOrgMemberInviteForm } from "@/components/platform/PlatformOrgMemberInviteForm";
import { TableFrame } from "@/components/ui/TableFrame";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Propriétaire",
  MANAGER: "Gestionnaire",
  AUDITOR: "Auditeur",
};

// v4 Bloc B : liste read-only des membres d'une org, pour la supervision staff.
export default async function OrgMembersSupervisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const { permissions } = await requirePlatformPage("organizations.read", `/platform/organizations/${orgId}/members`);
  const list = parseListPage(await searchParams);
  const result = await paginate(
    list,
    () => prisma.orgMembership.count({ where: { orgId } }),
    (range) =>
      prisma.orgMembership.findMany({
        where: { orgId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        ...range,
        select: {
          id: true,
          role: true,
          roleRef: { select: { name: true } },
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
  );
  const members = result.rows;

  return (
    <div className="space-y-4">
      {permissions.has("organizations.members.manage") && <PlatformOrgMemberInviteForm orgId={orgId} />}
      <h2 className="text-base font-semibold text-slate-800">Membres ({result.total})</h2>
      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-left text-[11px] font-semibold uppercase tracking-wider text-white">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Depuis</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
                  Aucun membre.
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{m.user.name}</td>
                <td className="px-4 py-3 text-slate-500">{m.user.email}</td>
                <td className="px-4 py-3 text-slate-500">{m.roleRef?.name ?? (m.role ? ROLE_LABEL[m.role] : null) ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-slate-400">
                  {new Date(m.createdAt).toLocaleDateString("fr-FR")}
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
