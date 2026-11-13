import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserContext } from "@/lib/user-context";
import { effectivePermissions } from "@/lib/permissions";
import { getApprovedPhotoUrl } from "@/lib/approved-photo";
import { prisma } from "@/lib/prisma";
import { countOrdersWithUnread, unreadByRequest } from "@/lib/print-requests/read-state";
import { StaffShell } from "@/components/staff/StaffShell";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/platform");

  const ctx = await getUserContext(session.user.id);
  if (!ctx) redirect("/login");
  // `isStaff` résiduel (rôle retiré) ou permission d'accès retirée par ajustement : retour à l'accueil.
  const permissions = effectivePermissions(ctx, { kind: "platform" });
  if (!ctx.isStaff || !ctx.platformRole || !permissions.has("platform.access")) redirect("/");

  // La pastille des commandes n'est calculée que pour qui peut les lire (3 requêtes).
  let pendingPrintRequests = 0;
  const photoUrlPromise = getApprovedPhotoUrl(ctx.user.id);
  if (permissions.has("print.requests.read")) {
    const [submitted, withUnread] = await Promise.all([
      prisma.printRequest.findMany({ where: { status: "SUBMITTED" }, select: { id: true } }),
      countOrdersWithUnread(ctx.user.id, "STAFF", {}),
    ]);
    // Commandes à traiter + commandes avec non-lus, sans compter deux fois celles qui sont les deux.
    const submittedUnread = await unreadByRequest(
      ctx.user.id,
      "STAFF",
      submitted.map((r) => r.id),
    );
    const both = Object.values(submittedUnread).filter((n) => n > 0).length;
    pendingPrintRequests = submitted.length + withUnread - both;
  }
  const photoUrl = await photoUrlPromise;

  return (
    <StaffShell
      user={{ name: ctx.user.name, email: ctx.user.email, roleName: ctx.platformRole.name }}
      permissions={permissions}
      photoUrl={photoUrl}
      pendingPrintRequests={pendingPrintRequests}
    >
      {children}
    </StaffShell>
  );
}
