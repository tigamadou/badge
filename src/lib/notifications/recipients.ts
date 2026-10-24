import type { EventRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { effectiveEventRole, staffRoleAtLeast } from "@/lib/auth-helpers";
import type { UserContext } from "@/types/auth";
import type { RecipientSpec } from "./types";

export type Recipient = { id: string; email: string; name: string };

const STAFF_ROLES_ORDER = ["STAFF_OBSERVER", "STAFF_SUPPORT", "STAFF_ADMIN", "SUPER_ADMIN"] as const;

// Résout les destinataires : comptes actifs uniquement, hors auteur et hors exclusions,
// dédoublonnés par id et triés (déterminisme).
export async function resolveRecipients(
  spec: RecipientSpec,
  opts: { actorId?: string | null; excludeUserIds?: Iterable<string> },
  db: Prisma.TransactionClient = prisma,
): Promise<Recipient[]> {
  const excluded = [...(opts.excludeUserIds ?? [])];
  if (opts.actorId) excluded.push(opts.actorId);
  const base: Prisma.UserWhereInput = {
    blocked: false,
    archived: false,
    id: { notIn: excluded },
  };
  const select = { id: true, email: true, name: true } as const;
  const orderBy = { id: "asc" } as const;

  if ("users" in spec) {
    return db.user.findMany({
      where: { ...base, id: { in: spec.users, notIn: excluded } },
      select,
      orderBy,
    });
  }

  if ("staffMinRole" in spec) {
    const min = spec.staffMinRole;
    const roles = STAFF_ROLES_ORDER.filter((r) => staffRoleAtLeast(r, min));
    return db.user.findMany({
      where: { ...base, isStaff: true, staffRole: { in: [...roles] } },
      select,
      orderBy,
    });
  }

  if ("orgRoles" in spec) {
    const { orgId, roles } = spec.orgRoles;
    return db.user.findMany({
      where: { ...base, orgMemberships: { some: { orgId, role: { in: roles } } } },
      select,
      orderBy,
    });
  }

  const { eventId, roles } = spec.eventRoles;
  const event = await db.event.findUnique({ where: { id: eventId }, select: { orgId: true } });
  if (!event) return [];
  const candidates = await db.user.findMany({
    where: {
      ...base,
      OR: [
        { eventMemberships: { some: { eventId } } },
        { orgMemberships: { some: { orgId: event.orgId } } },
      ],
    },
    select: {
      ...select,
      orgMemberships: { where: { orgId: event.orgId }, select: { orgId: true, role: true } },
      eventMemberships: { where: { eventId }, select: { eventId: true, role: true } },
    },
    orderBy,
  });
  return candidates
    .filter((u) => {
      // isStaff: false volontaire : le rôle STAFF n'est pas un rôle de membre d'évènement.
      const ctx: UserContext = {
        user: { id: u.id, email: u.email, name: u.name },
        isStaff: false,
        staffRole: null,
        orgMemberships: u.orgMemberships,
        eventMemberships: u.eventMemberships,
      };
      return roles.includes(effectiveEventRole(ctx, eventId, event.orgId) as EventRole);
    })
    .map(({ id, email, name }) => ({ id, email, name }));
}
