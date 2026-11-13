import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { getApprovedPhotoUrl } from "@/lib/approved-photo";
import { effectivePermissions, hasPermission } from "@/lib/permissions";
import { getOrgAccess } from "@/lib/org-access";
import { can } from "@/lib/subscription-rights";
import { OrgShell } from "@/components/admin/OrgShell";
import { OrgAccessGate } from "@/components/admin/OrgAccessGate";

export default async function OrgLayout({
  params,
  children,
}: {
  params: Promise<{ orgId: string }>;
  children: React.ReactNode;
}) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/org/${orgId}`);

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true, archived: true },
  });
  if (!org) notFound();

  // v4 Bloc B : fin des vues imbriquees. Le staff ne "descend" plus dans l'espace org ;
  // il supervise via /platform/organizations/[orgId]. Seuls les membres de l'organisation
  // qui detiennent `org.read` accedent a /org ; chaque page et chaque route verifie sa permission.
  const target = { kind: "org", orgId } as const;
  const isMember = ctx.orgMemberships.some((m) => m.orgId === orgId) && hasPermission(ctx, "org.read", target);
  if (!isMember) {
    if (ctx.isStaff) redirect(`/platform/organizations/${orgId}`);
    redirect("/select");
  }

  const photoUrl = await getApprovedPhotoUrl(ctx.user.id);

  const readableOrgIds = ctx.orgMemberships
    .filter((m) => hasPermission(ctx, "org.read", { kind: "org", orgId: m.orgId }))
    .map((m) => m.orgId);
  const orgs = await prisma.organization.findMany({
    where: ctx.isStaff ? {} : { id: { in: readableOrgIds } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  const permissions = [...effectivePermissions(ctx, target)];

  // Selon les droits de l'abonnement (réglage plateforme), l'espace peut être remplacé
  // par un écran bloquant. Ce layout n'est pas re-rendu lors d'une navigation douce :
  // il ne calcule que le droit, et OrgAccessGate (client) décide d'après le pathname
  // courant. L'onglet Abonnement et la liste des évènements restent toujours accessibles.
  // La redirection de /events/new reste dans sa page, rendue à chaque navigation.
  const canAccessOrgSpace = can(await getOrgAccess(orgId), "ACCESS_ORG_SPACE");

  return (
    <OrgShell
      org={org}
      user={{ name: ctx.user.name, email: ctx.user.email, isStaff: ctx.isStaff }}
      orgs={orgs}
      permissions={permissions}
      photoUrl={photoUrl}
    >
      <OrgAccessGate orgId={orgId} canAccessOrgSpace={canAccessOrgSpace}>
        {children}
      </OrgAccessGate>
    </OrgShell>
  );
}
