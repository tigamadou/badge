import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission, ROLE_SCOPE_ALLOWS } from "@/lib/permissions";
import { getRole, heldOn } from "@/lib/role-management";
import { RoleEditor } from "@/components/permissions/RoleEditor";
import { PermissionMatrix } from "@/components/permissions/PermissionMatrix";
import { Alert } from "@/components/ui/Feedback";

export const dynamic = "force-dynamic";

export default async function PlatformRolePage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  if (!ctx || !hasPermission(ctx, "platform.roles.manage", { kind: "platform" })) redirect("/platform");

  // Les rôles système de tous les niveaux sont lisibles ici ; les rôles personnalisés, ceux de la plateforme seulement.
  const role = await getRole(roleId, { kind: "platform" }).catch(() => null);
  if (!role) notFound();

  const readOnly = role.systemKey !== null || role.archived || role.scope !== "PLATFORM";
  return (
    <div className="space-y-4">
      <div>
        <Link href="/platform/roles" className="text-[13px] text-slate-400 hover:underline">
          Rôles
        </Link>
        <h1 className="mt-1 break-words text-xl font-semibold text-navy">{role.name}</h1>
        {role.description ? <p className="mt-0.5 text-sm text-slate-400">{role.description}</p> : null}
      </div>
      {readOnly ? (
        <>
          <Alert tone="info">
            {role.systemKey !== null
              ? "Rôle système : son contenu est fixé par le code. Vous pouvez le dupliquer pour créer un rôle personnalisé."
              : "Ce rôle est archivé : restaurez-le pour le modifier."}
          </Alert>
          <PermissionMatrix levels={ROLE_SCOPE_ALLOWS[role.scope]} selected={new Set(role.permissions)} readOnly />
        </>
      ) : (
        <RoleEditor
          mode="edit"
          scope="PLATFORM"
          initial={role}
          apiBase="/api/platform/roles"
          heldPermissions={[...heldOn(ctx, { kind: "platform" })]}
          redirectTo="/platform/roles"
        />
      )}
    </div>
  );
}
