import type { EventRole, OrgRole } from "@prisma/client";
import { legacyKeyOf } from "@/lib/permissions/db";
import type { SystemRoleKey } from "@/lib/permissions";
import { notifyAll, withNotificationGuard } from "@/lib/notifications/notify";
import {
  notifyEventMembershipAdded,
  notifyMembershipRoleChanged,
  notifyOrgMembershipAdded,
} from "@/lib/notifications/triggers";
import { prisma } from "@/lib/prisma";

// Les déclencheurs historiques ne connaissent que les rôles à clé d'enum. Pour un rôle sans enum
// (AGENT, rôle personnalisé), le même message est émis avec le nom du rôle.

export type RoleRef = { systemKey: string | null; name: string };

type Place = "ORG" | "EVENT";

/** Clé d'enum héritée du rôle (rôles système de niveau ORG / EVENT seulement) ; null sinon. */
function legacyOf(role: RoleRef): (OrgRole | EventRole) | null {
  return role.systemKey === null ? null : (legacyKeyOf(role.systemKey as SystemRoleKey) as OrgRole | EventRole | null);
}

async function target(place: Place, id: string) {
  if (place === "ORG") {
    const org = await prisma.organization.findUnique({ where: { id }, select: { name: true } });
    return org && { name: org.name, label: `l'organisation ${org.name}`, href: `/org/${encodeURIComponent(id)}`, open: "Ouvrir l'organisation" };
  }
  const event = await prisma.event.findUnique({ where: { id }, select: { title: true } });
  return event && { name: event.title, label: `l'évènement ${event.title}`, href: `/event/${encodeURIComponent(id)}`, open: "Ouvrir l'évènement" };
}

type Where = { orgId: string } | { eventId: string };
const placeOf = (w: Where): { place: Place; id: string } =>
  "orgId" in w ? { place: "ORG", id: w.orgId } : { place: "EVENT", id: w.eventId };

export async function notifyRoleAssigned(
  a: { userId: string; actorId: string; role: RoleRef; invitationSent: boolean } & Where,
): Promise<void> {
  const { place, id } = placeOf(a);
  const legacy = legacyOf(a.role);
  if (legacy) {
    if ("orgId" in a) return notifyOrgMembershipAdded({ userId: a.userId, orgId: a.orgId, role: legacy as OrgRole, actorId: a.actorId, invitationSent: a.invitationSent });
    return notifyEventMembershipAdded({ userId: a.userId, eventId: a.eventId, role: legacy as EventRole, actorId: a.actorId, invitationSent: a.invitationSent });
  }
  await withNotificationGuard("role-assigned", async () => {
    const t = await target(place, id);
    if (!t) return;
    await notifyAll([
      {
        type: place === "ORG" ? "ORG_MEMBERSHIP_ADDED" : "EVENT_MEMBERSHIP_ADDED",
        scope: place,
        recipients: { users: [a.userId] },
        actorId: a.actorId,
        ...("orgId" in a ? { orgId: a.orgId } : { eventId: a.eventId }),
        email: !a.invitationSent,
        content: {
          title: place === "ORG" ? "Ajout à une organisation" : "Ajout à un évènement",
          body: `Vous avez été ajouté(e) à ${t.label} avec le rôle ${a.role.name}.`,
          href: t.href,
          primaryLabel: t.open,
          anchor: t.name,
          links: [],
        },
      },
    ]);
  });
}

export async function notifyRoleChanged(
  a: { userId: string; actorId: string; from: RoleRef; to: RoleRef } & Where,
): Promise<void> {
  const { place, id } = placeOf(a);
  const from = legacyOf(a.from);
  const to = legacyOf(a.to);
  if (from && to) {
    return notifyMembershipRoleChanged({ userId: a.userId, actorId: a.actorId, from, to, ...("orgId" in a ? { orgId: a.orgId } : { eventId: a.eventId }) } as Parameters<typeof notifyMembershipRoleChanged>[0]);
  }
  if (a.from.name === a.to.name) return;
  await withNotificationGuard("role-changed", async () => {
    const t = await target(place, id);
    if (!t) return;
    await notifyAll([
      {
        type: "MEMBERSHIP_ROLE_CHANGED",
        scope: place,
        recipients: { users: [a.userId] },
        actorId: a.actorId,
        ...("orgId" in a ? { orgId: a.orgId } : { eventId: a.eventId }),
        content: {
          title: "Rôle modifié",
          body: `Votre rôle dans ${t.label} est passé de ${a.from.name} à ${a.to.name}.`,
          href: t.href,
          primaryLabel: t.open,
          anchor: t.name,
          links: [],
        },
      },
    ]);
  });
}
