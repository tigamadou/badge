import { redirect } from "next/navigation";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { OrgLogo, PickCard, PickCardDashed } from "@/components/ui/PickCard";
import { Tag } from "@/components/ui/Labels";

// v4 Bloc D : selecteur de workspace. Trois espaces top-level independants
// (/platform, /org/[orgId], /event/[eventId]). Affiche uniquement s'il y a
// plusieurs workspaces accessibles ; sinon redirige directement (regle alignee
// sur resolveHomeRedirect).
export default async function SelectPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const orgs = await prisma.organization.findMany({
    where: {
      memberships: {
        some: { userId: ctx.user.id, role: { in: ["OWNER", "MANAGER", "AUDITOR"] } },
      },
    },
    select: { id: true, name: true, slug: true, archived: true },
    orderBy: { name: "asc" },
  });

  // Evenements dont l'utilisateur est membre direct (role event dedie), affiches
  // comme workspaces a part entiere meme sans membership org.
  const eventMemberships = await prisma.eventMembership.findMany({
    where: { userId: ctx.user.id },
    select: {
      event: {
        select: {
          id: true,
          title: true,
          archived: true,
          organization: { select: { name: true } },
        },
      },
    },
    orderBy: { event: { title: "asc" } },
  });
  const events = eventMemberships.map((m) => m.event);

  const targets = [
    ...(ctx.isStaff ? ["/platform"] : []),
    ...orgs.map((o) => `/org/${o.id}`),
    ...events.map((e) => `/event/${e.id}`),
  ];
  if (targets.length === 0) redirect("/account");
  if (targets.length === 1) redirect(targets[0]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-50 px-5 py-16">
      <Image src="/logo.png" alt="Badge" width={120} height={30} className="mb-8 h-8 w-auto object-contain" />
      <div className="w-full max-w-3xl">
        <h1 className="mb-1 text-center text-[22px] font-semibold text-slate-900">Choisissez un espace</h1>
        <p className="mb-8 text-center text-sm text-slate-500">
          Accédez à l&apos;espace de gestion de votre choix.
        </p>

        {ctx.isStaff && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Plateforme</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              <PickCardDashed href="/platform" icon="shield" label="Administration de la plateforme" />
            </div>
          </section>
        )}

        {orgs.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Organisations</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {orgs.map((o) => (
                <PickCard
                  key={o.id}
                  href={`/org/${o.id}`}
                  logo={<OrgLogo name={o.name} />}
                  title={o.name}
                  subtitle={o.slug}
                  meta={o.archived ? <Tag>Archivée</Tag> : undefined}
                />
              ))}
            </div>
          </section>
        )}

        {events.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Événements</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {events.map((e) => (
                <PickCard
                  key={e.id}
                  href={`/event/${e.id}`}
                  logo={<OrgLogo name={e.title} />}
                  title={e.title}
                  subtitle={e.organization.name}
                  meta={e.archived ? <Tag>Archivé</Tag> : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
