import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { CatPill } from "@/components/ui/Labels";
import { requireEventPagePermission } from "../../_lib/page-access";

type Props = {
  params: Promise<{ eventId: string }>;
};

// ADR 2026-06-01 (v2-14 Task 4) : vue agregee accessible a VIEWER (et au-dessus).
// Aucune donnee nominative -- juste des comptes par statut et par categorie.
export default async function RegistrationsOverviewPage({ params }: Props) {
  const { eventId } = await params;
  const { orgId } = await requireEventPagePermission(
    eventId,
    "event.read.aggregated",
    `/event/${eventId}/registrations/overview`,
  );

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, orgId: true },
  });
  if (!event || event.orgId !== orgId) notFound();

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
      <div>
        <h1 className="text-xl font-semibold text-navy">Vue d&apos;ensemble</h1>
        <p className="mt-0.5 text-sm text-slate-400">{event.title} — répartition non nominative</p>
      </div>

      <StatGrid cols={3}>
        <StatCard label="En attente" value={pending} icon="clock" />
        <StatCard label="Approuvées" value={approved} icon="user-check" />
        <StatCard label="Rejetées" value={rejected} icon="x" />
      </StatGrid>

      <Card>
        <CardHead title="Répartition par catégorie" />
        <CardBody className="divide-y divide-slate-100 !py-0">
          {categories.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">Aucune catégorie.</p>
          ) : (
            categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3 text-sm">
                <CatPill color={c.color} label={`#${c.number} ${c.name}`} />
                <span className="font-mono tabular-nums text-slate-600">{c._count.registrations}</span>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Total comptabilisé" />
        <CardBody>
          <p className="text-sm text-slate-600">
            <span className="text-2xl font-semibold tabular-nums text-slate-900">{totalCountable}</span> inscription(s)
            (PENDING + APPROVED). Les rejets ne sont pas comptabilisés dans le quota.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
