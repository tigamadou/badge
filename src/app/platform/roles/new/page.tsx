import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission } from "@/lib/permissions";
import { getRole, heldOn } from "@/lib/role-management";
import { RoleEditor } from "@/components/permissions/RoleEditor";

export const dynamic = "force-dynamic";

export default async function NewPlatformRolePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  if (!ctx || !hasPermission(ctx, "platform.roles.manage", { kind: "platform" })) redirect("/platform");

  // `?from=<roleId>` : copie d'un rôle plateforme (système ou personnalisé) comme point de départ.
  const from = (await searchParams).from;
  const source = typeof from === "string" ? await getRole(from, { kind: "platform" }).catch(() => null) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">{source ? "Dupliquer un rôle" : "Nouveau rôle"}</h1>
        <p className="mt-0.5 text-sm text-slate-400">Rôle personnalisé de la plateforme.</p>
      </div>
      <RoleEditor
        mode={source ? "duplicate" : "create"}
        scope="PLATFORM"
        initial={source ?? undefined}
        apiBase="/api/platform/roles"
        heldPermissions={[...heldOn(ctx, { kind: "platform" })]}
        redirectTo="/platform/roles"
      />
    </div>
  );
}
