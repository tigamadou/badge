import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";

export default async function SelectPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const orgs = await prisma.organization.findMany({
    where: { memberships: { some: { userId: ctx.user.id, role: "OWNER" } } },
    select: { id: true, name: true, slug: true, archived: true },
    orderBy: { name: "asc" },
  });

  if (!ctx.isStaff && orgs.length === 1) {
    redirect(`/admin/${orgs[0].id}`);
  }
  if (!ctx.isStaff && orgs.length === 0) {
    redirect("/profile?message=no-org");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border rounded-lg p-6 max-w-md w-full space-y-4">
        <h1 className="text-xl font-bold">Choisissez une organisation</h1>
        {ctx.isStaff && (
          <Link
            href="/staff"
            className="block w-full rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
          >
            Espace staff applicatif
          </Link>
        )}
        <ul className="space-y-1">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/${o.id}`}
                className="block w-full rounded border px-4 py-3 text-sm hover:bg-gray-50"
              >
                {o.name}
                {o.archived && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-gray-200 text-xs">Archivée</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
