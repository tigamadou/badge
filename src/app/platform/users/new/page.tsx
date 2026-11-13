import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasPermission } from "@/lib/permissions";
import { listAssignableRoles } from "@/lib/role-management";
import { prisma } from "@/lib/prisma";
import { UserCreationForm } from "@/components/staff/UserCreationForm";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const ctx = await loadUserContext(session.user.id);
  if (!ctx || !ctx.isStaff) redirect("/");

  const platform = { kind: "platform" } as const;
  const canCreateClient = hasPermission(ctx, "users.create", platform);
  const canCreateStaff = hasPermission(ctx, "users.staff.create", platform);
  if (!canCreateClient && !canCreateStaff) redirect("/platform/users");

  const [orgs, platformRoles, orgRoles] = await Promise.all([
    prisma.organization.findMany({ where: { archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    canCreateStaff ? listAssignableRoles(ctx, { scope: "PLATFORM" }, platform) : [],
    // Rôles système d'organisation ; les rôles personnalisés d'une organisation sont relus à son choix.
    listAssignableRoles(ctx, { scope: "ORG" }, platform),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nouvel utilisateur</h1>
      <UserCreationForm
        orgs={orgs}
        canCreateStaff={canCreateStaff}
        canCreateClient={canCreateClient}
        platformRoles={platformRoles}
        orgRoles={orgRoles}
      />
    </div>
  );
}
