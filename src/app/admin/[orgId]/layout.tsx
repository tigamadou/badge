import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { hasOrgRole } from "@/lib/auth-helpers";
import { OrgShell } from "@/components/admin/OrgShell";

export default async function OrgLayout({
  params,
  children,
}: {
  params: Promise<{ orgId: string }>;
  children: React.ReactNode;
}) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/admin/${orgId}`);

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true, archived: true },
  });
  if (!org) notFound();

  if (!hasOrgRole(ctx, orgId, "OWNER") && !ctx.isStaff) {
    redirect("/select");
  }

  const orgs = await prisma.organization.findMany({
    where: ctx.isStaff
      ? {}
      : { memberships: { some: { userId: ctx.user.id, role: "OWNER" } } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  const isStaffMode = ctx.isStaff && !ctx.orgMemberships.some((m) => m.orgId === orgId);

  return (
    <OrgShell
      org={org}
      user={{ name: ctx.user.name, email: ctx.user.email, isStaff: ctx.isStaff }}
      orgs={orgs}
      isStaffMode={isStaffMode}
    >
      {children}
    </OrgShell>
  );
}
