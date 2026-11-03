import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
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

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");
  if (!ctx.isStaff || !ctx.staffRole) redirect("/");
  const [photoUrl, submitted, withUnread] = await Promise.all([
    getApprovedPhotoUrl(ctx.user.id),
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
  const pendingPrintRequests = submitted.length + withUnread - both;

  return (
    <StaffShell
      user={{ name: ctx.user.name, email: ctx.user.email, staffRole: ctx.staffRole }}
      photoUrl={photoUrl}
      pendingPrintRequests={pendingPrintRequests}
    >
      {children}
    </StaffShell>
  );
}
