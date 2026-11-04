import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { RoleBadge, Tag } from "@/components/ui/Labels";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { Icon } from "@/components/ui/Icon";
import { UserDetailActions } from "./UserDetailActions";

function initials(name: string | null): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const canAdmin =
    !!ctx && ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN");
  const canEditTopRoles = ctx?.staffRole === "SUPER_ADMIN";
  const canResetPassword =
    !!ctx && ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_SUPPORT");
  const isSelf = ctx?.user.id === userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isStaff: true,
      staffRole: true,
      archived: true,
      archivedAt: true,
      createdAt: true,
      orgMemberships: {
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true, archived: true } },
        },
      },
      eventMemberships: {
        select: {
          role: true,
          event: { select: { id: true, title: true, slug: true, orgId: true } },
        },
      },
    },
  });
  if (!user) notFound();

  const recentActivity = await prisma.activityLog.findMany({
    where: { OR: [{ userId }, { targetId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, createdAt: true, staffActor: true, orgId: true },
  });

  return (
    <div className="space-y-6">
      <Link href="/platform/users" className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600">
        <Icon name="arrow-left" size={13} /> Utilisateurs
      </Link>

      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
          {initials(user.name)}
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-navy">{user.name}</h1>
            {user.isStaff && user.staffRole && <RoleBadge tone="navy">{user.staffRole}</RoleBadge>}
            {user.archived && <Tag icon="archive">Archivé</Tag>}
          </div>
          <div className="text-sm text-slate-400">{user.email}</div>
        </div>
      </div>

      <Card>
        <CardHead title="Informations" />
        <CardBody>
          <KeyValue
            items={[
              { label: "Type", value: user.isStaff ? "Staff applicatif" : "Client" },
              { label: "Créé le", value: new Date(user.createdAt).toLocaleDateString("fr-FR") },
              { label: "Statut", value: user.archived ? "Archivé" : "Actif" },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title={`Organisations (${user.orgMemberships.length})`} />
        <CardBody className="divide-y divide-slate-100 !py-0">
          {user.orgMemberships.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">Aucune appartenance organisation.</p>
          ) : (
            user.orgMemberships.map((m) => (
              <div key={m.organization.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <Link href={`/platform/organizations/${m.organization.id}`} className="text-slate-900 hover:text-navy">
                  {m.organization.name}
                  {m.organization.archived && <span className="ml-2 text-xs text-slate-400">(archivée)</span>}
                </Link>
                <RoleBadge tone="slate">{m.role}</RoleBadge>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead title={`Événements (${user.eventMemberships.length})`} />
        <CardBody className="divide-y divide-slate-100 !py-0">
          {user.eventMemberships.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">Aucune appartenance événement.</p>
          ) : (
            user.eventMemberships.map((m) => (
              <div key={m.event.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-slate-900">{m.event.title}</span>
                <RoleBadge tone="slate">{m.role}</RoleBadge>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <UserDetailActions
        user={{
          id: user.id,
          isStaff: user.isStaff,
          staffRole: user.staffRole,
          archived: user.archived,
        }}
        canAdmin={canAdmin}
        canEditTopRoles={canEditTopRoles}
        canResetPassword={canResetPassword}
        isSelf={isSelf}
      />

      <Card>
        <CardHead title="Journal récent" />
        <CardBody>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune activité.</p>
          ) : (
            <Timeline>
              {recentActivity.map((a) => (
                <TimelineItem
                  key={a.id}
                  tone={a.staffActor ? "warn" : "ok"}
                  title={a.type}
                  meta={`${a.staffActor ? "Staff · " : ""}${new Date(a.createdAt).toLocaleString("fr-FR")}`}
                />
              ))}
            </Timeline>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
