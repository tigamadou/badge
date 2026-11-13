import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions/resolve";
import { USER_CONTEXT_SELECT, buildUserContext } from "@/lib/user-context";
import type { RecipientSpec } from "./types";

export type Recipient = { id: string; email: string; name: string };

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

  const { permission, target } = spec;
  // Staff porteur d'un rôle plateforme (colonne d'enum comprise) ou d'un ajustement plateforme.
  const staffCandidates: Prisma.UserWhereInput[] = [
    { isStaff: true, OR: [{ platformRoleId: { not: null } }, { staffRole: { not: null } }] },
    { permissionOverrides: { some: { orgId: null } } },
  ];
  const memberCandidates: Prisma.UserWhereInput[] =
    target.kind === "org"
      ? [{ orgMemberships: { some: { orgId: target.orgId } } }, { permissionOverrides: { some: { orgId: target.orgId } } }]
      : target.kind === "event"
        ? [
            { orgMemberships: { some: { orgId: target.orgId } } },
            { eventMemberships: { some: { eventId: target.eventId } } },
            { permissionOverrides: { some: { orgId: target.orgId } } },
          ]
        : [];
  const candidates = target.kind === "platform" || spec.includeStaff ? [...memberCandidates, ...staffCandidates] : memberCandidates;

  const rows = await db.user.findMany({
    where: { ...base, OR: candidates },
    select: USER_CONTEXT_SELECT,
    orderBy,
  });
  return rows
    .filter((row) => hasPermission(buildUserContext(row), permission, target))
    .map(({ id, email, name }) => ({ id, email, name }));
}
