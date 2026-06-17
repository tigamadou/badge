import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { effectiveEventRole } from "@/lib/auth-helpers";

type Props = {
  params: Promise<{ orgId: string; eventId: string }>;
};

// ADR 2026-06-01 (v2-14 Task 4) : vue agregee accessible a VIEWER (et au-dessus).
// Aucune donnee nominative -- juste des comptes par statut et par categorie.
export default async function RegistrationsOverviewPage({ params }: Props) {
  const { orgId, eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) notFound();

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) notFound();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, orgId: true },
  });
  if (!event || event.orgId !== orgId) notFound();

  const role = effectiveEventRole(ctx, event.id, event.orgId);
  if (!role) notFound();

  const [pending, approved, rejected, categories] = await Promise.all([
    prisma.registration.count({ where: { eventId, status: "PENDING" } }),
    prisma.registration.count({ where: { eventId, status: "APPROVED" } }),
    prisma.registration.count({ where: { eventId, status: "REJECTED" } }),
    prisma.category.findMany({
      where: { eventId },
      orderBy: { number: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        number: true,
        _count: { select: { registrations: true } },
      },
    }),
  ]);

  const totalCountable = pending + approved;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vue d&apos;ensemble — {event.title}</h1>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="En attente" value={pending} color="amber" />
        <KpiCard label="Approuvees" value={approved} color="green" />
        <KpiCard label="Rejetees" value={rejected} color="red" />
      </section>

      <section className="bg-white border rounded p-4">
        <h2 className="font-semibold mb-3">Par categorie</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune categorie.</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded"
                    style={{ backgroundColor: c.color }}
                  />
                  <span>
                    #{c.number} {c.name}
                  </span>
                </span>
                <span className="font-mono">{c._count.registrations}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border rounded p-4">
        <h2 className="font-semibold mb-1">Total comptabilise</h2>
        <p className="text-sm text-gray-600">
          {totalCountable} inscription(s) (PENDING + APPROVED). Les rejets ne sont
          pas comptabilises dans le quota.
        </p>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "amber" | "green" | "red";
}) {
  const colorClasses: Record<typeof color, string> = {
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    green: "bg-green-50 border-green-200 text-green-900",
    red: "bg-red-50 border-red-200 text-red-900",
  };
  return (
    <div className={`rounded border p-4 ${colorClasses[color]}`}>
      <div className="text-xs uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}
