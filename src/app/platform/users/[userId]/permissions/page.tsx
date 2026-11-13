import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission } from "@/lib/permissions";
import { heldOn, loadPlatformLevels } from "@/lib/role-management";
import { Alert } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { UserPermissionsEditor } from "@/components/permissions/UserPermissionsEditor";
import { LevelSwitcher } from "@/components/permissions/LevelSwitcher";
import { grantablePermissions } from "@/components/permissions/logic";

export const dynamic = "force-dynamic";

export default async function UserPermissionsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  // Pas le droit, ou son propre compte : retour à la fiche.
  if (!ctx || ctx.user.id === userId || !hasPermission(ctx, "users.permissions.manage", { kind: "platform" })) {
    redirect(`/platform/users/${userId}`);
  }

  const [user, levels] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    loadPlatformLevels(userId),
  ]);
  if (!user || !levels) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/platform/users/${userId}`} className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600">
        <Icon name="arrow-left" size={13} /> {user.name}
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-navy">Permissions de {user.name}</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          {user.email} · Ajoutez ou retirez des permissions par rapport au rôle. Un retrait l&apos;emporte sur un ajout.
        </p>
      </div>
      <Alert tone="info">
        Vous ne pouvez ajouter que des permissions que vous détenez vous-même. Les permissions réservées aux rôles
        système ne sont pas ajustables.
      </Alert>
      <LevelSwitcher
        items={levels.map((level) => {
          const isPlatform = level.target.kind === "platform";
          const orgId = level.target.kind === "org" ? level.target.orgId : null;
          return {
            value: orgId ?? "platform",
            label: level.target.kind === "org" ? level.target.orgName : "Plateforme",
            content: (
              <UserPermissionsEditor
                levels={[level]}
                endpoint={`/api/platform/users/${userId}/permissions`}
                heldPermissions={grantablePermissions(heldOn(ctx, orgId ? { kind: "org", orgId } : { kind: "platform" }))}
                scopes={isPlatform ? ["PLATFORM", "ORG", "EVENT", "PARTICIPANT"] : ["ORG", "EVENT"]}
                sendOrgId
              />
            ),
          };
        })}
      />
    </div>
  );
}
