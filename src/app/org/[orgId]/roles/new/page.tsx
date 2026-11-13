import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission } from "@/lib/permissions";
import { getRole, heldOn } from "@/lib/role-management";
import { RoleEditor } from "@/components/permissions/RoleEditor";

export const dynamic = "force-dynamic";

export default async function NewOrgRolePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  if (!ctx || !hasPermission(ctx, "org.roles.manage", { kind: "org", orgId })) redirect(`/org/${orgId}`);

  // `?from=<roleId>` copie un rôle (la portée suit la source) ; sinon `?scope=ORG|EVENT`.
  const query = await searchParams;
  const source = typeof query.from === "string" ? await getRole(query.from, { kind: "org", orgId }).catch(() => null) : null;
  const scope = source ? (source.scope === "EVENT" ? "EVENT" : "ORG") : query.scope === "EVENT" ? "EVENT" : "ORG";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">{source ? "Dupliquer un rôle" : "Nouveau rôle"}</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Rôle personnalisé {scope === "EVENT" ? "d'évènement" : "d'organisation"}.
        </p>
      </div>
      <RoleEditor
        mode={source ? "duplicate" : "create"}
        scope={scope}
        initial={source ?? undefined}
        apiBase={`/api/org/${orgId}/roles`}
        heldPermissions={[...heldOn(ctx, { kind: "org", orgId })]}
        redirectTo={`/org/${orgId}/roles?tab=${scope === "EVENT" ? "event" : "org"}`}
        sendScope
      />
    </div>
  );
}
