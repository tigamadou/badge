import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
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

  return (
    <StaffShell
      user={{ name: ctx.user.name, email: ctx.user.email, staffRole: ctx.staffRole }}
    >
      {children}
    </StaffShell>
  );
}
