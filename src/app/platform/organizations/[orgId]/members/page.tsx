import { prisma } from "@/lib/prisma";
import { PlatformOrgMemberInviteForm } from "@/components/platform/PlatformOrgMemberInviteForm";
import { TableFrame } from "@/components/ui/TableFrame";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Propriétaire",
  MANAGER: "Gestionnaire",
  AUDITOR: "Auditeur",
};

// v4 Bloc B : liste read-only des membres d'une org, pour la supervision staff.
export default async function OrgMembersSupervisionPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const members = await prisma.orgMembership.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="space-y-4">
      <PlatformOrgMemberInviteForm orgId={orgId} />
      <h2 className="text-base font-semibold text-slate-800">Membres ({members.length})</h2>
      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
                <td className="px-4 py-3 text-slate-500">{ROLE_LABEL[m.role] ?? m.role}</td>
                <td className="px-4 py-3 tabular-nums text-slate-400">
                  {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    </div>
  );
}
