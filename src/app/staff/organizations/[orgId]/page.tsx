import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { QuotaBar } from "@/components/ui/QuotaBar";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { OrgLogo } from "@/components/ui/PickCard";
import { Tag } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";
import { OrgDetailActions } from "./OrgDetailActions";

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const canDelete = ctx?.staffRole === "SUPER_ADMIN";

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
      quotaMaxEvents: true,
      quotaMaxRegistrations: true,
      quotaMaxStorageMB: true,
      memberships: {
        where: { role: "OWNER" },
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

  return (
    <div className="space-y-6">
      <Link
        href="/staff/organizations"
        className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600"
      >
        <Icon name="arrow-left" size={13} /> Organisations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <OrgLogo name={org.name} size={48} />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{org.name}</h1>
            <p className="mt-0.5 font-mono text-[13px] text-slate-400">
              {org.slug} · {org._count.events} événement(s)
            </p>
            {org.archived && (
              <div className="mt-1.5">
                <Tag icon="archive">
                  Archivée{org.archivedAt ? ` le ${new Date(org.archivedAt).toLocaleDateString("fr-FR")}` : ""}
                </Tag>
              </div>
            )}
          </div>
        </div>
        {/* ADR 2026-06-01 (v2-14 Task 5) : acces direct a l'espace org en mode staff. */}
        <Link
          href={`/admin/${org.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <Icon name="external-link" size={16} /> Entrer dans l&apos;organisation
        </Link>
      </div>

      <StatGrid cols={3}>
        <StatCard label="Événements" value={org._count.events} icon="calendar" />
        <StatCard label="OWNERs" value={org._count.memberships} icon="users" />
        <StatCard
          label="Stockage max"
          value={org.quotaMaxStorageMB ? `${org.quotaMaxStorageMB} Mo` : "Illimité"}
          icon="hard-drive"
        />
      </StatGrid>

      <Card>
        <CardHead title="Quotas" />
        <CardBody>
          <QuotaBar
            label="Événements"
            valueText={`${org._count.events} / ${org.quotaMaxEvents ?? "∞"}`}
            pct={org.quotaMaxEvents ? Math.round((org._count.events / org.quotaMaxEvents) * 100) : 0}
          />
          <KeyValue
            items={[
              { label: "Quota inscriptions", value: org.quotaMaxRegistrations?.toString() ?? "Illimité" },
              { label: "Quota stockage", value: org.quotaMaxStorageMB ? `${org.quotaMaxStorageMB} Mo` : "Illimité" },
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

      <OrgDetailActions org={{ id: org.id, slug: org.slug, archived: org.archived }} canDelete={canDelete} />
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
