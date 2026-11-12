import type { NotificationScope, NotificationType, OrgRole, EventRole, Prisma } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import {
  badgePrintedMessage, emailFailedMessage, eventMembershipAddedMessage, eventRegistrationToggledMessage,
  membershipRoleChangedMessage, orgCreatedMessage, orgMembershipAddedMessage, profileApprovedMessage,
  profileRejectedMessage, profileSubmittedMessage, quotaExceededMessage, registrationApprovedMessage,
  registrationCreatedMessage, registrationRejectedMessage, registrationResubmittedMessage,
  subscriptionChangedMessage, subscriptionExpiringMessage,
} from "../../../../src/lib/notifications/messages";
import type { NotificationContent } from "../../../../src/lib/notifications/types";
import { DEMO_SLUG_PREFIX } from "../../constants";
import { insertInBatches, type DemoContext } from "../context";
import { isDemoUserWhere, type DemoWorld, type WorldOrg, type WorldUser } from "../billing/world";
import type { SeededJobs } from "./jobs";
import { chunkIds } from "./activity";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 60;
const READ_RATIO = 0.6;

type Row = Prisma.NotificationCreateManyInput;

/** Les 4 types du domaine impression : écrits par le lot 2a, jamais ici. */
export const PRINT_NOTIFICATION_TYPES: NotificationType[] = [
  "PRINT_REQUEST_SUBMITTED", "PRINT_REQUEST_QUOTED", "PRINT_REQUEST_MESSAGE", "PRINT_REQUEST_STATUS_CHANGED",
];

/** Supprime les notifications de démo (destinataires de démo, organisations ou évènements `demo-`). */
export async function cleanupNotifications(): Promise<number> {
  const orgs = await prisma.organization.findMany({ where: { slug: { startsWith: DEMO_SLUG_PREFIX } }, select: { id: true } });
  const orgIds = orgs.map((o) => o.id);
  const events = await prisma.event.findMany({ where: { orgId: { in: orgIds } }, select: { id: true } });
  const users = await prisma.user.findMany({ where: isDemoUserWhere, select: { id: true } });
  const eventIds = events.map((e) => e.id);
  let count = 0;
  for (const userIds of chunkIds(users.map((u) => u.id))) {
    const res = await prisma.notification.deleteMany({
      where: {
        type: { notIn: PRINT_NOTIFICATION_TYPES },
        OR: [{ userId: { in: userIds } }, { orgId: { in: orgIds } }, { eventId: { in: eventIds } }],
      },
    });
    count += res.count;
  }
  return count;
}

const active = (u: WorldUser) => !u.blocked && !u.archived;
const uniqueUsers = (users: WorldUser[]): WorldUser[] => [...new Map(users.map((u) => [u.id, u])).values()];

export async function seedNotifications(ctx: DemoContext, world: DemoWorld, jobs: SeededJobs): Promise<void> {
  const { faker, dates } = ctx;
  const now = dates.now.getTime();
  const total = ctx.scaled(400, 150);
  const share = (ratio: number) => Math.max(3, Math.round(total * ratio));

  // ---------- Monde relu ----------
  const orgOfEvent = new Map<string, WorldOrg>();
  for (const org of world.orgs) for (const e of org.events) orgOfEvent.set(e.id, org);
  const eventMembersRows = await prisma.eventMembership.findMany({
    where: { eventId: { in: [...orgOfEvent.keys()] } },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  const eventMembers = new Map<string, { user: WorldUser; role: EventRole }[]>();
  for (const m of eventMembersRows) {
    const user: WorldUser = {
      id: m.user.id, email: m.user.email, name: m.user.name, staffRole: m.user.staffRole,
      blocked: m.user.blocked, archived: m.user.archived, createdAt: m.user.createdAt,
    };
    eventMembers.set(m.eventId, [...(eventMembers.get(m.eventId) ?? []), { user, role: m.role ?? "VIEWER" }]);
  }
  const orgRecipients = (org: WorldOrg) => uniqueUsers([...org.owners, ...org.members]).filter(active);
  const eventRecipients = (eventId: string): WorldUser[] => {
    const org = orgOfEvent.get(eventId);
    return uniqueUsers([...(eventMembers.get(eventId)?.map((m) => m.user) ?? []), ...(org ? orgRecipients(org) : [])]).filter(active);
  };
  const staff = world.staff.filter(active);
  const adminStaff = staff.filter((u) => u.staffRole === "SUPER_ADMIN" || u.staffRole === "STAFF_ADMIN");
  const featuredStaff = adminStaff[0] ?? staff[0];
  const featuredOwner = world.orgs.find((o) => o.owners.some(active))?.owners.find(active);

  const demoEventIds = [...orgOfEvent.keys()];
  const registrations = await prisma.registration.findMany({
    where: { eventId: { in: demoEventIds }, user: { ...isDemoUserWhere, blocked: false, archived: false } },
    include: { user: { select: { id: true, name: true } }, event: { select: { id: true, title: true, slug: true } }, category: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 3000,
  });
  const regsByStatus = (status: string) => registrations.filter((r) => r.status === status);
  const profileUsers = await prisma.user.findMany({
    where: { ...isDemoUserWhere, blocked: false, archived: false, profileStatus: { in: ["PENDING", "APPROVED", "REJECTED"] } },
    select: { id: true, name: true, profileStatus: true },
    orderBy: { id: "asc" },
  });

  const rows: Row[] = [];
  /** Date dans la fenêtre de 60 jours, jamais avant `after` quand elle est donnée. */
  const when = (after?: Date): Date => {
    const floor = now - WINDOW_DAYS * DAY_MS;
    let t = dates.between(0.05, WINDOW_DAYS).getTime();
    if (after && t < after.getTime()) t = Math.min(now, after.getTime() + faker.number.int({ min: 1, max: 72 }) * 3_600_000);
    return new Date(Math.min(now, Math.max(floor, t)));
  };
  const add = (
    type: NotificationType, scope: NotificationScope, user: WorldUser | { id: string },
    content: NotificationContent, at: Date, ids: { orgId?: string; eventId?: string } = {},
    forceUnread = false,
  ) => {
    let readAt: Date | null = null;
    if (!forceUnread && faker.number.float({ min: 0, max: 1 }) < READ_RATIO) {
      const t = at.getTime() + faker.number.int({ min: 5 * 60_000, max: 3 * DAY_MS });
      if (t <= now) readAt = new Date(t);
    }
    rows.push({
      userId: user.id, type, scope, orgId: ids.orgId ?? null, eventId: ids.eventId ?? null,
      title: content.title, body: content.body, href: content.href,
      links: [{ label: content.primaryLabel, href: content.href }, ...content.links],
      readAt, createdAt: at,
    });
  };

  // ---------- Inscriptions : nouvelles et resoumises (organisateurs) ----------
  const orgRegs = registrations.filter((r) => eventRecipients(r.eventId).length > 0);
  const createdRegs = (n: number, list = orgRegs) => faker.helpers.arrayElements(list, Math.min(n, list.length));
  for (const r of createdRegs(share(0.2))) {
    const to = faker.helpers.arrayElement(eventRecipients(r.eventId));
    const org = orgOfEvent.get(r.eventId)!;
    add("REGISTRATION_CREATED", "EVENT", to,
      registrationCreatedMessage({ eventId: r.eventId, eventTitle: r.event.title, registrationId: r.id, participantName: r.user.name, categoryName: r.category.name }),
      when(r.createdAt), { orgId: org.id, eventId: r.eventId });
  }
  // Propriétaire très servi (pagination) : ses 45 dernières inscriptions, les 25 plus récentes non lues.
  if (featuredOwner) {
    const featuredOrg = world.orgs.find((o) => o.owners.some((u) => u.id === featuredOwner.id))!;
    const own = registrations.filter((r) => orgOfEvent.get(r.eventId)?.id === featuredOrg.id).slice(0, 45);
    own.forEach((r, i) =>
      add("REGISTRATION_CREATED", "EVENT", featuredOwner,
        registrationCreatedMessage({ eventId: r.eventId, eventTitle: r.event.title, registrationId: r.id, participantName: r.user.name, categoryName: r.category.name }),
        new Date(now - (i + 1) * 2 * 3_600_000 - 600_000), { orgId: featuredOrg.id, eventId: r.eventId }, i < 25));
  }
  for (const r of createdRegs(share(0.05))) {
    const to = faker.helpers.arrayElement(eventRecipients(r.eventId));
    const org = orgOfEvent.get(r.eventId)!;
    add("REGISTRATION_RESUBMITTED", "EVENT", to,
      registrationResubmittedMessage({
        eventId: r.eventId, eventTitle: r.event.title, registrationId: r.id, participantName: r.user.name,
        categoryChanged: faker.datatype.boolean() ? { from: "Participant", to: r.category.name } : undefined,
      }),
      when(r.createdAt), { orgId: org.id, eventId: r.eventId });
  }

  // ---------- Inscriptions : décisions et badge (participants) ----------
  for (const r of faker.helpers.arrayElements(regsByStatus("APPROVED"), share(0.15))) {
    add("REGISTRATION_APPROVED", "PARTICIPANT", r.user, registrationApprovedMessage({ eventTitle: r.event.title, registrationId: r.id }), when(r.createdAt));
  }
  for (const r of faker.helpers.arrayElements(regsByStatus("REJECTED"), share(0.06))) {
    add("REGISTRATION_REJECTED", "PARTICIPANT", r.user,
      registrationRejectedMessage({ eventTitle: r.event.title, registrationId: r.id, reason: r.rejectionReason }), when(r.createdAt));
  }
  for (const r of faker.helpers.arrayElements(registrations.filter((x) => x.badgePrinted), share(0.08))) {
    add("BADGE_PRINTED", "PARTICIPANT", r.user, badgePrintedMessage({ eventTitle: r.event.title, registrationId: r.id }), when(r.createdAt));
  }

  // ---------- Profils ----------
  const byProfile = (s: string) => profileUsers.filter((u) => u.profileStatus === s);
  for (const u of faker.helpers.arrayElements(byProfile("PENDING"), share(0.04))) {
    for (const to of (staff.length > 0 ? faker.helpers.arrayElements(adminStaff.length > 0 ? adminStaff : staff, 2) : [])) {
      add("PROFILE_SUBMITTED", "PLATFORM", to, profileSubmittedMessage({ userId: u.id, userName: u.name }), when());
    }
  }
  for (const u of faker.helpers.arrayElements(byProfile("APPROVED"), share(0.06))) {
    add("PROFILE_APPROVED", "PARTICIPANT", u, profileApprovedMessage(), when());
  }
  for (const u of faker.helpers.arrayElements(byProfile("REJECTED"), share(0.03))) {
    add("PROFILE_REJECTED", "PARTICIPANT", u, profileRejectedMessage({ reason: "Photo illisible" }), when());
  }

  // ---------- Membres, rôles, ouverture des inscriptions ----------
  const orgMemberships = await prisma.orgMembership.findMany({
    where: { orgId: { in: world.orgs.map((o) => o.id) }, user: { blocked: false, archived: false } },
    include: { user: { select: { id: true } }, organization: { select: { id: true, name: true } } },
  });
  for (const m of orgMemberships) {
    add("ORG_MEMBERSHIP_ADDED", "ORG", m.user,
      orgMembershipAddedMessage({ orgId: m.orgId, orgName: m.organization.name, role: m.role as OrgRole }), when(), { orgId: m.orgId });
  }
  const roleChange: Record<OrgRole, OrgRole> = { OWNER: "MANAGER", MANAGER: "AUDITOR", AUDITOR: "MANAGER" };
  for (const m of faker.helpers.arrayElements(orgMemberships.filter((x) => x.role !== "OWNER"), Math.max(2, Math.round(orgMemberships.length / 3)))) {
    add("MEMBERSHIP_ROLE_CHANGED", "ORG", m.user,
      membershipRoleChangedMessage({ target: { kind: "org", orgId: m.orgId, name: m.organization.name }, from: roleChange[m.role ?? "AUDITOR"], to: m.role ?? "AUDITOR" }),
      when(), { orgId: m.orgId });
  }
  for (const m of eventMembersRows) {
    const org = orgOfEvent.get(m.eventId);
    const event = org?.events.find((e) => e.id === m.eventId);
    if (!org || !event || !active(eventMembers.get(m.eventId)!.find((x) => x.user.id === m.userId)!.user)) continue;
    add("EVENT_MEMBERSHIP_ADDED", "EVENT", m.user,
      eventMembershipAddedMessage({ eventId: event.id, eventTitle: event.title, role: m.role ?? "VIEWER" }), when(), { orgId: org.id, eventId: event.id });
  }
  for (const org of world.orgs.filter((o) => !o.archived)) {
    for (const event of org.events.filter((e) => !e.archived && eventRecipients(e.id).length > 0)) {
      const open = event.registrationOpen;
      for (const to of faker.helpers.arrayElements(eventRecipients(event.id), 3)) {
        add(open ? "EVENT_REGISTRATION_OPENED" : "EVENT_REGISTRATION_CLOSED", "EVENT", to,
          eventRegistrationToggledMessage({ eventId: event.id, eventTitle: event.title, eventSlug: event.slug, open }),
          when(), { orgId: org.id, eventId: event.id });
      }
    }
  }
  // Une ouverture et une fermeture au moins, quel que soit l'état courant des évènements.
  const sample = world.orgs.flatMap((o) => o.events.filter((e) => !e.archived && eventRecipients(e.id).length > 0).map((e) => ({ o, e })));
  for (const open of [true, false]) {
    const pair = sample.find(({ e }) => e.registrationOpen !== open);
    if (!pair) continue;
    const to = faker.helpers.arrayElement(eventRecipients(pair.e.id));
    add(open ? "EVENT_REGISTRATION_OPENED" : "EVENT_REGISTRATION_CLOSED", "EVENT", to,
      eventRegistrationToggledMessage({ eventId: pair.e.id, eventTitle: pair.e.title, eventSlug: pair.e.slug, open }),
      when(), { orgId: pair.o.id, eventId: pair.e.id });
  }

  // ---------- Plateforme : organisations ----------
  for (const org of world.orgs) {
    for (const to of faker.helpers.arrayElements(adminStaff.length > 0 ? adminStaff : staff, 2)) {
      add("ORG_CREATED", "PLATFORM", to, orgCreatedMessage({ orgId: org.id, orgName: org.name }), when(), { orgId: org.id });
    }
  }

  // ---------- Abonnements ----------
  const orgById = new Map(world.orgs.map((o) => [o.id, o]));
  const subscriptions = await prisma.subscription.findMany({
    where: { orgId: { in: [...orgById.keys()] } },
    include: { plan: true, reminders: true },
  });
  const subByOrg = new Map(subscriptions.map((s) => [s.orgId, s]));
  const approved = await prisma.payment.findMany({
    where: { orgId: { in: [...orgById.keys()] }, purpose: "SUBSCRIPTION", status: "APPROVED" },
    include: { plan: true },
    orderBy: { approvedAt: "asc" },
  });
  for (const p of approved) {
    const org = orgById.get(p.orgId)!;
    const sub = subByOrg.get(p.orgId)!;
    const at = new Date(Math.min(now, Math.max(p.approvedAt!.getTime(), now - (WINDOW_DAYS - 1) * DAY_MS)));
    const common = { orgId: org.id, orgName: org.name, planName: p.plan!.name, status: sub.status };
    for (const owner of org.owners.filter(active)) {
      add("SUBSCRIPTION_CHANGED", "ORG", owner, subscriptionChangedMessage({ ...common, audience: "org" }), at, { orgId: org.id });
    }
    if (staff.length > 0) {
      add("SUBSCRIPTION_CHANGED", "PLATFORM", faker.helpers.arrayElement(adminStaff.length > 0 ? adminStaff : staff),
        subscriptionChangedMessage({ ...common, audience: "platform" }), at, { orgId: org.id });
    }
  }
  for (const sub of subscriptions) {
    const org = orgById.get(sub.orgId)!;
    for (const reminder of sub.reminders) {
      for (const owner of org.owners.filter(active)) {
        add("SUBSCRIPTION_EXPIRING", "ORG", owner,
          subscriptionExpiringMessage({ orgId: org.id, orgName: org.name, planName: sub.plan.name, daysBefore: reminder.daysBefore, endDate: reminder.endDate }),
          reminder.sentAt, { orgId: org.id });
      }
    }
    // Depassement delibere de l'essai : evenements au-dela de maxEvents.
    const limit = sub.overrideMaxEvents ?? sub.plan.maxEvents;
    const open = org.events.filter((e) => !e.archived).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (sub.status === "ACTIVE" && limit !== null && open.length > limit) {
      const extra = open[limit];
      const at = when(sub.startDate);
      for (const owner of org.owners.filter(active)) {
        add("QUOTA_EXCEEDED", "ORG", owner, quotaExceededMessage({ orgId: org.id, orgName: org.name, eventId: extra.id, audience: "org" }), at, { orgId: org.id, eventId: extra.id });
      }
      for (const to of faker.helpers.arrayElements(adminStaff.length > 0 ? adminStaff : staff, 2)) {
        add("QUOTA_EXCEEDED", "PLATFORM", to, quotaExceededMessage({ orgId: org.id, orgName: org.name, eventId: extra.id, audience: "platform" }), at, { orgId: org.id, eventId: extra.id });
      }
    }
  }

  // ---------- Emails en échec ----------
  for (const j of jobs.failed) {
    for (const to of faker.helpers.arrayElements(adminStaff.length > 0 ? adminStaff : staff, 2)) {
      add("EMAIL_FAILED", "PLATFORM", to, emailFailedMessage({ jobId: j.id, kind: j.kind, recipient: j.recipient, attempts: j.attempts }), j.completedAt);
    }
  }

  // Le staff le plus sollicité garde une part de non lues (pagination du cloche plateforme).
  if (featuredStaff) {
    rows.filter((r) => r.userId === featuredStaff.id && r.scope === "PLATFORM").slice(0, 25).forEach((r) => { r.readAt = null; });
  }

  await insertInBatches(rows, (data) => prisma.notification.createMany({ data }), 1000);
}
