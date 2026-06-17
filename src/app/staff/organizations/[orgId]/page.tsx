import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <div className="text-sm text-slate-500 font-mono">/{org.slug}</div>
          {org.archived && (
            <div className="mt-1 text-sm text-amber-700">
              Archivee le{" "}
              {org.archivedAt &&
                new Date(org.archivedAt).toLocaleDateString("fr-FR")}
            </div>
          )}
        </div>
        {/* ADR 2026-06-01 (v2-14 Task 5) : acces direct a l'espace org en mode staff. */}
        <Link
          href={`/admin/${org.id}`}
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
        >
          Entrer dans l&apos;organisation →
        </Link>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          label="Events"
          value={fmtQuota(org.quotaMaxEvents, org._count.events)}
        />
        <Card label="OWNERs" value={String(org._count.memberships)} />
        <Card
          label="Stockage max"
          value={
            org.quotaMaxStorageMB ? `${org.quotaMaxStorageMB} Mo` : "Illimite"
          }
        />
      </section>

      <section className="bg-white border rounded p-4 space-y-2">
        <h2 className="text-lg font-semibold">Informations administratives</h2>
        <Row label="Raison sociale" value={org.legalName} />
        <Row label="Adresse" value={formatAddress(org)} />
        <Row label="Identifiant fiscal" value={org.taxId} />
        <Row label="Site web" value={org.website} />
        <Row label="Contact email" value={org.contactEmail} />
        <Row label="Contact telephone" value={org.contactPhone} />
      </section>

      <section className="bg-white border rounded p-4 space-y-2">
        <h2 className="text-lg font-semibold">Quotas</h2>
        <Row
          label="Quota max events"
          value={org.quotaMaxEvents?.toString() ?? "Illimite"}
        />
        <Row
          label="Quota max inscriptions"
          value={org.quotaMaxRegistrations?.toString() ?? "Illimite"}
        />
        <Row
          label="Quota max stockage (Mo)"
          value={org.quotaMaxStorageMB?.toString() ?? "Illimite"}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">OWNERs</h2>
        <ul className="bg-white border rounded divide-y">
          {org.memberships.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">
              Aucun OWNER associe.
            </li>
          )}
          {org.memberships.map((m) => (
            <li
              key={m.user.id}
              className="px-4 py-3 text-sm flex justify-between"
            >
              <span>{m.user.name}</span>
              <span className="text-slate-500">{m.user.email}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">
          Derniers evenements ({org._count.events})
        </h2>
        <ul className="bg-white border rounded divide-y">
          {org.events.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">
              Aucun evenement.
            </li>
          )}
          {org.events.map((e) => (
            <li key={e.id} className="px-4 py-3 text-sm flex justify-between">
              <span>
                {e.title}
                {e.archived && (
                  <span className="ml-2 text-amber-700">(archive)</span>
                )}
              </span>
              <span className="text-slate-500 text-xs">
                {new Date(e.date).toLocaleDateString("fr-FR")} —{" "}
                {e._count.registrations} inscriptions
              </span>
            </li>
          ))}
        </ul>
      </section>

      <OrgDetailActions
        org={{ id: org.id, slug: org.slug, archived: org.archived }}
        canDelete={canDelete}
      />

      <div>
        <Link
          href="/staff/organizations"
          className="text-sm text-blue-600 hover:underline"
        >
          Retour a la liste
        </Link>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-3 text-sm">
      <div className="text-slate-500">{label}</div>
      <div className="col-span-2">
        {value ?? <span className="text-slate-400">—</span>}
      </div>
    </div>
  );
}

function fmtQuota(max: number | null, used: number): string {
  if (max == null) return `${used} / illimite`;
  return `${used} / ${max}`;
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
