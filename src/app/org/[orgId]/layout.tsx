import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { getApprovedPhotoUrl } from "@/lib/approved-photo";
import { hasOrgRole } from "@/lib/auth-helpers";
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
  // il supervise via /platform/organizations/[orgId]. Seuls les membres org (OWNER/MANAGER/
  // AUDITOR) accedent a /org ; la matrice de permissions est appliquee route par route.
  const isMember = hasOrgRole(ctx, orgId, "AUDITOR"); // sans allowStaff
  if (!isMember) {
    if (ctx.isStaff) redirect(`/platform/organizations/${orgId}`);
    redirect("/select");
  }

  const photoUrl = await getApprovedPhotoUrl(ctx.user.id);

  const orgs = await prisma.organization.findMany({
    where: ctx.isStaff
      ? {}
      : {
          memberships: {
            some: { userId: ctx.user.id, role: { in: ["OWNER", "MANAGER", "AUDITOR"] } },
          },
        },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  // v4 Bloc C : role effectif du membre pour filtrer la nav. Seuls des membres
  // atteignent ce point (staff redirige plus haut), donc la membership existe.
  const orgRole = ctx.orgMemberships.find((m) => m.orgId === orgId)?.role ?? "AUDITOR";

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
      orgRole={orgRole}
      photoUrl={photoUrl}
    >
      <OrgAccessGate orgId={orgId} canAccessOrgSpace={canAccessOrgSpace}>
        {children}
      </OrgAccessGate>
    </OrgShell>
  );
}
