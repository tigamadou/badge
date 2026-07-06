import { redirect } from "next/navigation";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { OrgLogo, PickCard, PickCardDashed } from "@/components/ui/PickCard";
import { Tag } from "@/components/ui/Labels";

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
    <div className="flex min-h-screen flex-col items-center bg-slate-50 px-5 py-16">
      <Image src="/logo.png" alt="Badge" width={120} height={30} className="mb-8 h-8 w-auto object-contain" />
      <div className="w-full max-w-3xl">
        <h1 className="mb-1 text-center text-[22px] font-semibold text-slate-900">Choisissez une organisation</h1>
        <p className="mb-8 text-center text-sm text-slate-500">Accédez à l&apos;espace de gestion de votre choix.</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {orgs.map((o) => (
            <PickCard
              key={o.id}
              href={`/admin/${o.id}`}
              logo={<OrgLogo name={o.name} />}
              title={o.name}
              subtitle={o.slug}
              meta={o.archived ? <Tag>Archivée</Tag> : undefined}
            />
          ))}
          {ctx.isStaff && (
            <PickCardDashed href="/staff" icon="shield" label="Toutes les organisations · Mode staff" />
          )}
        </div>
      </div>
    </div>
  );
}
