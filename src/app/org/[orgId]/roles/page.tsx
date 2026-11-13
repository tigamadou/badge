import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission } from "@/lib/permissions";
import { listRoles } from "@/lib/role-management";
import { TabLinks } from "@/components/ui/TabLinks";
import { RoleTable } from "@/components/permissions/RoleTable";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "org", label: "Organisation", scope: "ORG" },
  { value: "event", label: "Évènement", scope: "EVENT" },
] as const;

export default async function OrgRolesPage({
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

  const raw = (await searchParams).tab;
  const tab = TABS.find((t) => t.value === raw) ?? TABS[0];
  const roles = await listRoles({ scope: tab.scope, orgId }, { includeArchived: true });
  const base = `/org/${orgId}/roles`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy">Rôles</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Rôles système communs et rôles personnalisés de votre organisation.
          </p>
        </div>
        <Link
          href={`${base}/new?scope=${tab.scope}`}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-hover"
        >
          Nouveau rôle
        </Link>
      </div>
      <TabLinks
        label="Niveaux de rôles"
        value={tab.value}
        tabs={TABS.map((t) => ({ value: t.value, label: t.label, href: `${base}?tab=${t.value}` }))}
      />
      <RoleTable
        roles={roles.map((r) => ({ ...r }))}
        apiBase={`/api/org/${orgId}/roles`}
        editHref={`${base}/:id`}
        duplicateHref={`${base}/new?from=:id`}
        canManage
      />
    </div>
  );
}
