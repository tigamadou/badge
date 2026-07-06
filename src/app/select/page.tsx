import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { AuthCard } from "@/components/auth/AuthCard";

export default async function SelectPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  // ADR 2026-06-01 (v2-14 Task 2) : etend a tous les roles org (OWNER, MANAGER, AUDITOR).
  // Auparavant filtre `role: "OWNER"` excluait MANAGER et AUDITOR de leur propre selection.
  const orgs = await prisma.organization.findMany({
    where: {
      memberships: {
        some: {
          userId: ctx.user.id,
          role: { in: ["OWNER", "MANAGER", "AUDITOR"] },
        },
      },
    },
    select: { id: true, name: true, slug: true, archived: true },
    orderBy: { name: "asc" },
  });

  if (!ctx.isStaff && orgs.length === 1) {
    redirect(`/admin/${orgs[0].id}`);
  }
  if (!ctx.isStaff && orgs.length === 0) {
    redirect("/profile?message=no-org");
  }
  if (ctx.isStaff && orgs.length === 0) {
    redirect("/staff");
  }

  return (
    <AuthCard title="Choisissez une organisation">
      <div className="space-y-4">
        {ctx.isStaff && (
          <Link
            href="/staff"
            className="block w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
          >
            Espace staff applicatif
          </Link>
        )}
        <ul className="space-y-1">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/${o.id}`}
                className="block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm hover:bg-slate-50"
              >
                {o.name}
                {o.archived && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-slate-200 text-xs">Archivée</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AuthCard>
  );
}
