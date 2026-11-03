import type { StaffRole } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { DEMO_BADGE_LOCAL_EMAILS, DEMO_DOMAIN, DEMO_SLUG_PREFIX } from "../../constants";

export type WorldUser = {
  id: string;
  email: string;
  name: string;
  staffRole: StaffRole | null;
  blocked: boolean;
  archived: boolean;
  createdAt: Date;
};

export type WorldEvent = {
  id: string;
  slug: string;
  title: string;
  date: Date;
  archived: boolean;
  registrationOpen: boolean;
  createdAt: Date;
  /** Inscriptions PENDING + APPROVED (celles qui comptent pour le quota). */
  countable: number;
};

export type WorldOrg = {
  id: string;
  slug: string;
  name: string;
  archived: boolean;
  owners: WorldUser[];
  members: WorldUser[];
  events: WorldEvent[];
  createdAt: Date;
};

export type DemoWorld = {
  orgs: WorldOrg[];
  /** Staff de démo actif (ni bloqué, ni archivé, ni invitation en attente). */
  staff: WorldUser[];
  /** Participants de démo actifs ayant au moins une inscription. */
  participants: WorldUser[];
};

export const isDemoUserWhere = {
  OR: [{ email: { endsWith: DEMO_DOMAIN } }, { email: { in: [...DEMO_BADGE_LOCAL_EMAILS] } }],
};

const toUser = (u: {
  id: string; email: string; name: string; staffRole: StaffRole | null;
  blocked: boolean; archived: boolean; createdAt: Date;
}): WorldUser => ({
  id: u.id, email: u.email, name: u.name, staffRole: u.staffRole,
  blocked: u.blocked, archived: u.archived, createdAt: u.createdAt,
});

/** Relit en base le monde déjà seedé (organisations `demo-`, comptes de démo, inscriptions). */
export async function loadWorld(): Promise<DemoWorld> {
  const orgRows = await prisma.organization.findMany({
    where: { slug: { startsWith: DEMO_SLUG_PREFIX } },
    include: {
      memberships: { include: { user: true }, orderBy: { createdAt: "asc" } },
      events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });
  const counts = await prisma.registration.groupBy({
    by: ["eventId"],
    where: { status: { in: ["PENDING", "APPROVED"] }, eventId: { in: orgRows.flatMap((o) => o.events.map((e) => e.id)) } },
    _count: { _all: true },
  });
  const countByEvent = new Map(counts.map((c) => [c.eventId, c._count._all]));

  const orgs: WorldOrg[] = orgRows.map((o) => ({
    id: o.id,
    slug: o.slug,
    name: o.name,
    archived: o.archived,
    createdAt: o.createdAt,
    owners: o.memberships.filter((m) => m.role === "OWNER").map((m) => toUser(m.user)),
    members: o.memberships.filter((m) => m.role !== "OWNER").map((m) => toUser(m.user)),
    events: o.events.map((e) => ({
      id: e.id, slug: e.slug, title: e.title, date: e.date, archived: e.archived,
      registrationOpen: e.registrationOpen, createdAt: e.createdAt,
      countable: countByEvent.get(e.id) ?? 0,
    })),
  }));
  const size = (o: WorldOrg) => o.events.reduce((sum, e) => sum + e.countable, 0);
  orgs.sort((a, b) => size(b) - size(a) || a.id.localeCompare(b.id));

  const users = await prisma.user.findMany({
    where: { ...isDemoUserWhere, blocked: false, archived: false },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { _count: { select: { registrations: true } } },
  });
  const staff = users.filter((u) => u.isStaff && !u.inviteToken && u.staffRole).map(toUser);
  const participants = users.filter((u) => !u.isStaff && u._count.registrations > 0).map(toUser);

  return { orgs, staff, participants };
}
