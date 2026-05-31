import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { UserCreationForm } from "@/components/staff/UserCreationForm";

export default async function NewUserPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const ctx = await loadUserContext(session.user.id);
  if (!ctx || !ctx.isStaff || !ctx.staffRole) redirect("/");

  const canCreateStaff = staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN");
  const canCreateTopStaff = ctx.staffRole === "SUPER_ADMIN";

  const orgs = await prisma.organization.findMany({
    where: { archived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nouvel utilisateur</h1>
      <UserCreationForm
        orgs={orgs}
        canCreateStaff={canCreateStaff}
        canCreateTopStaff={canCreateTopStaff}
      />
    </div>
  );
}
