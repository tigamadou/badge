import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { hasOrgRole } from "@/lib/auth-helpers";
import { resolveOrgLimits } from "@/lib/subscription";
import { OrgShell } from "@/components/admin/OrgShell";
import { SubscriptionBlockedNotice } from "@/components/admin/SubscriptionBlockedNotice";

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

  // Sans abonnement actif, l'organisation ne peut rien faire : tout l'espace est
  // remplace par un ecran bloquant, SAUF l'onglet Abonnement (lecture seule) pour
  // que l'org puisse consulter son statut et ses dates.
  const { active } = await resolveOrgLimits(orgId);
  const pathname = (await headers()).get("x-pathname") ?? "";
  const onSubscriptionTab = pathname.endsWith("/subscription");
  const content =
    active || onSubscriptionTab ? children : <SubscriptionBlockedNotice orgId={orgId} />;

  return (
    <OrgShell
      org={org}
      user={{ name: ctx.user.name, email: ctx.user.email, isStaff: ctx.isStaff }}
      orgs={orgs}
      orgRole={orgRole}
    >
      {content}
    </OrgShell>
  );
}
