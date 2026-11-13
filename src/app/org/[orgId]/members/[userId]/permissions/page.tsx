import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission } from "@/lib/permissions";
import { heldOn, loadOrgLevel } from "@/lib/role-management";
import { Alert } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { UserPermissionsEditor } from "@/components/permissions/UserPermissionsEditor";
import { grantablePermissions } from "@/components/permissions/logic";

export const dynamic = "force-dynamic";

export default async function MemberPermissionsPage({ params }: { params: Promise<{ orgId: string; userId: string }> }) {
  const { orgId, userId } = await params;
  const members = `/org/${orgId}/members`;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  if (!ctx || ctx.user.id === userId || !hasPermission(ctx, "org.members.permissions.manage", { kind: "org", orgId })) {
    redirect(members);
  }

  const level = await loadOrgLevel(userId, orgId);
  if (!level) redirect(members);
  // Un autre propriétaire n'est modifiable que par la plateforme.
  if (level.role?.systemKey === "OWNER" && !hasPermission(ctx, "users.permissions.manage", { kind: "platform" })) {
    redirect(members);
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } });

  return (
    <div className="max-w-4xl space-y-6">
      <Link href={members} className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600">
        <Icon name="arrow-left" size={13} /> Membres
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-navy">Permissions de {user.name}</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          {user.email} · Les ajustements s&apos;appliquent à l&apos;organisation et à tous ses évènements.
        </p>
      </div>
      <Alert tone="info">Vous ne pouvez ajouter que des permissions que vous détenez vous-même.</Alert>
      <UserPermissionsEditor
        levels={[level]}
        endpoint={`/api/org/${orgId}/members/${userId}/permissions`}
        heldPermissions={grantablePermissions(heldOn(ctx, { kind: "org", orgId }))}
        scopes={["ORG", "EVENT"]}
        sendOrgId={false}
      />
    </div>
  );
}
