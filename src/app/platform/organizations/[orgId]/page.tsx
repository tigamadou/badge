import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { resolveOrgLimits } from "@/lib/subscription";
import { requirePlatformPage } from "@/app/platform/page-guard";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { QuotaBar } from "@/components/ui/QuotaBar";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { Tag } from "@/components/ui/Labels";
import { OrgDetailActions } from "./OrgDetailActions";

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const { permissions } = await requirePlatformPage("organizations.read", `/platform/organizations/${orgId}`);
  const canArchive = permissions.has("organizations.archive");
  const canDelete = permissions.has("organizations.delete");
  const canManageSubscription = permissions.has("subscriptions.update");

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      legalName: true,
      slug: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      country: true,
      taxId: true,
      website: true,
      contactEmail: true,
      contactPhone: true,
      archived: true,
      archivedAt: true,
      createdAt: true,
      subscription: {
        select: { status: true, endDate: true, plan: { select: { name: true, period: true } } },
      },
      memberships: {
        where: { OR: [{ roleRef: { systemKey: "OWNER" } }, { roleId: null, role: "OWNER" }] },
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      events: {
        select: {
          id: true,
          title: true,
          slug: true,
          date: true,
          archived: true,
          _count: { select: { registrations: true } },
        },
        orderBy: { date: "desc" },
        take: 20,
      },
      _count: { select: { events: true, memberships: true } },
    },
  });
  if (!org) notFound();

  const limits = await resolveOrgLimits(org.id);

  return (
    <div className="space-y-6">
      {/* v4 Bloc B : plus de bouton "Entrer dans l'organisation". Le staff supervise en
          lecture seule via les onglets (PlatformOrgShell) ; il agit via l'API (pouvoir staff). */}
      <p className="font-mono text-[13px] text-slate-400">
        {org.slug} · {org._count.events} événement(s)
      </p>
      {org.archived && (
        <Tag icon="archive">
          Archivée{org.archivedAt ? ` le ${new Date(org.archivedAt).toLocaleDateString("fr-FR")}` : ""}
        </Tag>
      )}

      <StatGrid cols={3}>
        <StatCard label="Événements" value={org._count.events} icon="calendar" />
        <StatCard label="OWNERs" value={org._count.memberships} icon="users" />
        <StatCard
          label="Plan"
          value={org.subscription?.plan.name ?? "Aucun"}
          icon="credit-card"
        />
      </StatGrid>

      <Card>
        <CardHead
          title="Abonnement"
          action={
            <Link
              href={`/platform/organizations/${org.id}/subscription`}
              className="text-[13px] font-medium text-navy hover:underline"
            >
              {canManageSubscription ? "Gérer" : "Voir"}
            </Link>
          }
        />
        <CardBody>
          <QuotaBar
            label="Événements"
            valueText={`${org._count.events} / ${limits.maxEvents ?? "∞"}`}
            pct={limits.maxEvents ? Math.round((org._count.events / limits.maxEvents) * 100) : 0}
          />
          <KeyValue
            items={[
              { label: "Statut", value: org.subscription?.status ?? "Aucun abonnement" },
              {
                label: "Période",
                value:
                  org.subscription?.plan.period === "ANNUAL"
                    ? "Annuel"
                    : org.subscription?.plan.period === "MONTHLY"
                      ? "Mensuel"
                      : "—",
              },
              {
                label: "Participants / event",
                value: limits.maxParticipantsPerEvent?.toString() ?? "Illimité",
              },
              { label: "Actif", value: limits.active ? "Oui" : "Non" },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Informations administratives" />
        <CardBody>
          <KeyValue
            items={[
              { label: "Raison sociale", value: org.legalName ?? "—" },
              { label: "Adresse", value: formatAddress(org) ?? "—" },
              { label: "Identifiant fiscal", value: org.taxId ?? "—" },
              { label: "Site web", value: org.website ?? "—" },
              { label: "Contact e-mail", value: org.contactEmail ?? "—" },
              { label: "Contact téléphone", value: org.contactPhone ?? "—" },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="OWNERs" />
        <CardBody className="divide-y divide-slate-100 !py-0">
          {org.memberships.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">Aucun OWNER associé.</p>
          ) : (
            org.memberships.map((m) => (
              <div key={m.user.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-slate-900">{m.user.name}</span>
                <span className="text-slate-400">{m.user.email}</span>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead title={`Derniers événements (${org._count.events})`} />
        <CardBody className="divide-y divide-slate-100 !py-0">
          {org.events.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">Aucun événement.</p>
          ) : (
            org.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="flex items-center gap-2 text-slate-900">
                  {e.title}
                  {e.archived && <Tag icon="archive">archivé</Tag>}
                </span>
                <span className="text-xs tabular-nums text-slate-400">
                  {new Date(e.date).toLocaleDateString("fr-FR")} · {e._count.registrations} inscriptions
                </span>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <OrgDetailActions
        org={{ id: org.id, slug: org.slug, archived: org.archived }}
        canArchive={canArchive}
        canDelete={canDelete}
      />
    </div>
  );
}

function formatAddress(org: {
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
}): string | null {
  const parts = [
    org.addressLine1,
    org.addressLine2,
    [org.postalCode, org.city].filter(Boolean).join(" ") || null,
    org.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
