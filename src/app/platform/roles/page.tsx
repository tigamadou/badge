import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission } from "@/lib/permissions";
import { listRoles } from "@/lib/role-management";
import { TabLinks } from "@/components/ui/TabLinks";
import { Alert } from "@/components/ui/Feedback";
import { RoleTable } from "@/components/permissions/RoleTable";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "platform", label: "Plateforme", scope: "PLATFORM" },
  { value: "org", label: "Organisation", scope: "ORG" },
  { value: "event", label: "Évènement", scope: "EVENT" },
] as const;

export default async function PlatformRolesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  if (!ctx || !hasPermission(ctx, "platform.roles.manage", { kind: "platform" })) redirect("/platform");

  const raw = (await searchParams).tab;
  const tab = TABS.find((t) => t.value === raw) ?? TABS[0];
  const roles = await listRoles({ scope: tab.scope }, { includeArchived: true });
  const editable = tab.scope === "PLATFORM";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy">Rôles</h1>
          <p className="mt-0.5 text-sm text-slate-400">Rôles système et rôles personnalisés de la plateforme.</p>
        </div>
        {editable ? (
          <Link href="/platform/roles/new" className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-hover">
            Nouveau rôle
          </Link>
        ) : null}
      </div>
      <TabLinks
        label="Niveaux de rôles"
        value={tab.value}
        tabs={TABS.map((t) => ({ value: t.value, label: t.label, href: `/platform/roles?tab=${t.value}` }))}
      />
      {!editable ? (
        <Alert tone="info">
          Les rôles de ce niveau sont consultables ici. Les rôles personnalisés d&apos;une organisation sont gérés par
          l&apos;organisation elle-même.
        </Alert>
      ) : null}
      <RoleTable
        roles={roles.map((r) => ({ ...r }))}
        apiBase="/api/platform/roles"
        editHref="/platform/roles/:id"
        duplicateHref={editable ? "/platform/roles/new?from=:id" : undefined}
        canManage={editable}
      />
    </div>
  );
}
