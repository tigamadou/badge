import { ActivityType, type Prisma } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { DEMO_SLUG_PREFIX } from "../../constants";
import { insertInBatches, type DemoContext } from "../context";
import { isDemoUserWhere, type DemoWorld, type WorldOrg } from "../billing/world";
import type { SeededJobs } from "./jobs";

/** Types du domaine impression : écrits (et nettoyés) par le lot 2a. */
export const PRINT_ACTIVITY_TYPES: ActivityType[] = Object.values(ActivityType).filter((t) => t.startsWith("PRINT_"));

/** Types écrits par `writeBillingActivity` (lot facturation), conservés quand seul le reste est réécrit. */
export const BILLING_ACTIVITY_TYPES: ActivityType[] = [
  "PLAN_CREATED", "PLAN_UPDATED", "SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "QUOTA_BYPASS",
  "PAYMENT_INITIATED", "PAYMENT_APPROVED", "PAYMENT_FAILED",
];

/**
 * Supprime le journal de démo hors impression : entrées rattachées à une organisation `demo-`,
 * à un évènement de ces organisations ou à un utilisateur de démo. `keepBilling` épargne celles de la facturation.
 */
export async function cleanupActivity(opts: { keepBilling?: boolean } = {}): Promise<number> {
  const orgs = await prisma.organization.findMany({ where: { slug: { startsWith: DEMO_SLUG_PREFIX } }, select: { id: true } });
  const orgIds = orgs.map((o) => o.id);
  const events = await prisma.event.findMany({ where: { orgId: { in: orgIds } }, select: { id: true } });
  const users = await prisma.user.findMany({ where: isDemoUserWhere, select: { id: true } });
  const res = await prisma.activityLog.deleteMany({
    where: {
      type: { notIn: opts.keepBilling ? [...PRINT_ACTIVITY_TYPES, ...BILLING_ACTIVITY_TYPES] : PRINT_ACTIVITY_TYPES },
      OR: [
        { orgId: { in: orgIds } },
        { eventId: { in: events.map((e) => e.id) } },
        { userId: { in: users.map((u) => u.id) } },
      ],
    },
  });
  return res.count;
}

/**
 * Types non seedés, volontairement : suppressions définitives (action staff explicite, jamais
 * jouée dans le monde de démo, où toute ligne seedée existe encore).
 */
export const ACTIVITY_NOT_SEEDED: ActivityType[] = ["USER_DELETED", "ORG_DELETED", "REGISTRATION_DELETED"];

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WINDOW_DAYS = 180;
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

type Entry = Prisma.ActivityLogCreateManyInput;
type Actor = { id: string } | null;

export async function seedActivity(ctx: DemoContext, world: DemoWorld, jobs: SeededJobs): Promise<void> {
  const { faker } = ctx;
  const now = ctx.dates.now.getTime();
  const floor = now - WINDOW_DAYS * DAY_MS;
  // Les lignes non antedatees (comptes, membres) naissent apres `ctx.dates.now` : plafond = horloge reelle.
  const ceiling = Math.max(now, Date.now());
  const rand = (min: number, max: number) => faker.number.int({ min, max });
  /** Instant dans la fenêtre de 180 jours. */
  const clamp = (ms: number) => new Date(Math.min(ceiling, Math.max(floor, ms)));
  /** Instant au plus tôt `base` (créé avant `now`), `min`..`max` ms plus tard, plafonné à maintenant. */
  const after = (base: Date, min: number, max: number) => clamp(base.getTime() + rand(min, max));
  const anytime = (base?: Date) => (base ? after(base, HOUR_MS, WINDOW_DAYS * DAY_MS) : clamp(now - rand(HOUR_MS, WINDOW_DAYS * DAY_MS)));

  // ---------- Monde relu ----------
  const orgIds = world.orgs.map((o) => o.id);
  const orgOfEvent = new Map<string, WorldOrg>();
  for (const o of world.orgs) for (const e of o.events) orgOfEvent.set(e.id, o);
  const eventById = new Map(world.orgs.flatMap((o) => o.events.map((e) => [e.id, e] as const)));
  const eventIds = [...orgOfEvent.keys()];

  const users = await prisma.user.findMany({ where: isDemoUserWhere, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const staffIds = new Set(users.filter((u) => u.isStaff).map((u) => u.id));
  const staff = world.staff;
  const admin: Actor = staff.find((u) => u.staffRole === "STAFF_ADMIN") ?? staff.find((u) => u.staffRole === "SUPER_ADMIN") ?? staff[0] ?? null;
  const anyStaff = () => (staff.length > 0 ? faker.helpers.arrayElement(staff) : null);

  const [orgMemberships, eventMemberships, registrations, categories, templates, settings, reasons, badgeTemplates, submissions] = await Promise.all([
    prisma.orgMembership.findMany({ where: { orgId: { in: orgIds } }, orderBy: { createdAt: "asc" } }),
    prisma.eventMembership.findMany({ where: { eventId: { in: eventIds } }, orderBy: { createdAt: "asc" } }),
    prisma.registration.findMany({
      where: { eventId: { in: eventIds } },
      select: { id: true, eventId: true, userId: true, status: true, badgePrinted: true, badgePrintedAt: true, allAccessGranted: true, rejectionReason: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.category.findMany({ where: { eventId: { in: eventIds } }, orderBy: { id: "asc" } }),
    prisma.categoryTemplate.findMany({ where: { orgId: { in: orgIds } }, orderBy: { id: "asc" } }),
    prisma.eventSettings.findMany({ where: { eventId: { in: eventIds } } }),
    prisma.rejectionReason.findMany({ orderBy: { id: "asc" } }),
    prisma.installedBadgeTemplate.findMany({ where: { family: { startsWith: DEMO_SLUG_PREFIX } }, orderBy: { id: "asc" } }),
    prisma.profileSubmission.findMany({ where: { userId: { in: users.map((u) => u.id) } }, orderBy: { createdAt: "asc" } }),
  ]);

  // Acteurs : membres de l'évènement ou de l'organisation, sinon un membre du staff.
  const orgActor = (org: WorldOrg): Actor => {
    const pool = [...org.owners, ...org.members].filter((u) => !u.blocked && !u.archived);
    return pool.length > 0 ? faker.helpers.arrayElement(pool) : anyStaff();
  };
  const eventMembersOf = new Map<string, string[]>();
  for (const m of eventMemberships) eventMembersOf.set(m.eventId, [...(eventMembersOf.get(m.eventId) ?? []), m.userId]);
  const eventActor = (eventId: string): Actor => {
    const org = orgOfEvent.get(eventId)!;
    const ids = eventMembersOf.get(eventId) ?? [];
    return ids.length > 0 ? { id: faker.helpers.arrayElement(ids) } : orgActor(org);
  };

  const entries: Entry[] = [];
  const add = (
    type: ActivityType, at: Date, actor: Actor,
    e: { orgId?: string | null; eventId?: string | null; targetId?: string | null; details?: Prisma.InputJsonValue; ip?: boolean } = {},
  ) => {
    const orgId = e.orgId ?? null;
    entries.push({
      type, createdAt: at, userId: actor?.id ?? null, orgId, eventId: e.eventId ?? null, targetId: e.targetId ?? null,
      details: e.details, staffActor: actor !== null && orgId !== null && staffIds.has(actor.id),
      ipAddress: e.ip ? faker.internet.ipv4() : null, userAgent: e.ip ? faker.helpers.arrayElement(USER_AGENTS) : null,
    });
  };

  // ---------- Organisations et évènements ----------
  const restoredOrg = world.orgs.find((o) => !o.archived && o.events.length === 0) ?? world.orgs.filter((o) => !o.archived).at(-1);
  for (const org of world.orgs) {
    const created = after(org.createdAt, 0, HOUR_MS);
    const creator = org.archived || org.owners.length === 0 ? admin : org.owners[0];
    add("ORG_CREATED", created, creator, { orgId: org.id, targetId: org.id, details: { name: org.name } });
    add("ORG_UPDATED", anytime(created), orgActor(org), {
      orgId: org.id, targetId: org.id, details: { changes: { contactPhone: { from: "—", to: "+33 1 00 00 00 00" } } },
    });
    if (org.archived) {
      const row = await prisma.organization.findUniqueOrThrow({ where: { id: org.id }, select: { archivedAt: true } });
      add("ORG_ARCHIVED", clamp((row.archivedAt ?? new Date(now - 40 * DAY_MS)).getTime()), admin, { orgId: org.id, targetId: org.id, details: { name: org.name } });
    }
    if (org.id === restoredOrg?.id) {
      const archivedAt = anytime(created);
      add("ORG_ARCHIVED", archivedAt, admin, { orgId: org.id, targetId: org.id, details: { name: org.name } });
      add("ORG_RESTORED", after(archivedAt, HOUR_MS, 3 * DAY_MS), admin, { orgId: org.id, targetId: org.id, details: { name: org.name } });
    }
    const orgEvents = org.events;
    for (const event of orgEvents) {
      const eventCreated = after(event.createdAt, 0, HOUR_MS);
      add("EVENT_CREATED", eventCreated, orgActor(org), { orgId: org.id, eventId: event.id, targetId: event.id, details: { title: event.title } });
      add("EVENT_UPDATED", anytime(eventCreated), orgActor(org), {
        orgId: org.id, eventId: event.id, targetId: event.id, details: { changes: { location: { from: "À définir", to: "Centre de congrès" } } },
      });
      if (event.archived) add("EVENT_ARCHIVED", anytime(eventCreated), orgActor(org), { orgId: org.id, eventId: event.id, targetId: event.id, details: { title: event.title } });
      if (!event.archived) {
        add(event.registrationOpen ? "EVENT_REGISTRATION_OPENED" : "EVENT_REGISTRATION_CLOSED", anytime(eventCreated), orgActor(org), {
          orgId: org.id, eventId: event.id, targetId: event.id, details: { title: event.title },
        });
      }
    }
  }
  const restoredEvent = world.orgs.flatMap((o) => o.events).find((e) => !e.archived);
  if (restoredEvent) {
    const org = orgOfEvent.get(restoredEvent.id)!;
    const archivedAt = anytime(restoredEvent.createdAt);
    const ids = { orgId: org.id, eventId: restoredEvent.id, targetId: restoredEvent.id, details: { title: restoredEvent.title } };
    add("EVENT_ARCHIVED", archivedAt, orgActor(org), ids);
    add("EVENT_RESTORED", after(archivedAt, HOUR_MS, 2 * DAY_MS), orgActor(org), ids);
  }
  for (const s of settings) {
    const org = orgOfEvent.get(s.eventId)!;
    add("EVENT_SETTINGS_UPDATED", anytime(eventById.get(s.eventId)!.createdAt), orgActor(org), {
      orgId: org.id, eventId: s.eventId, targetId: s.eventId, details: { changes: { contactEmail: { from: "—", to: s.contactEmail ?? "—" } } },
    });
  }
  for (const c of categories) {
    const org = orgOfEvent.get(c.eventId)!;
    const created = after(eventById.get(c.eventId)!.createdAt, MINUTE_MS, HOUR_MS);
    add("CATEGORY_CREATED", created, orgActor(org), { orgId: org.id, eventId: c.eventId, targetId: c.id, details: { categoryName: c.name } });
  }
  for (const c of faker.helpers.arrayElements(categories, Math.min(categories.length, ctx.scaled(8, 2)))) {
    const org = orgOfEvent.get(c.eventId)!;
    add("CATEGORY_UPDATED", anytime(eventById.get(c.eventId)!.createdAt), orgActor(org), {
      orgId: org.id, eventId: c.eventId, targetId: c.id, details: { changes: { color: { from: "#999999", to: c.color } } },
    });
  }
  const deletedCategorySource = categories[0];
  if (deletedCategorySource) {
    const org = orgOfEvent.get(deletedCategorySource.eventId)!;
    add("CATEGORY_DELETED", anytime(eventById.get(deletedCategorySource.eventId)!.createdAt), orgActor(org), {
      orgId: org.id, eventId: deletedCategorySource.eventId, targetId: `${deletedCategorySource.id}-supprimee`, details: { categoryName: "Catégorie supprimée" },
    });
  }
  for (const t of templates) {
    const org = world.orgs.find((o) => o.id === t.orgId)!;
    add("CATEGORY_TEMPLATE_CREATED", after(t.createdAt, 0, HOUR_MS), orgActor(org), { orgId: org.id, targetId: t.id, details: { categoryName: t.name } });
  }
  const templateSample = templates[0];
  if (templateSample) {
    const org = world.orgs.find((o) => o.id === templateSample.orgId)!;
    add("CATEGORY_TEMPLATE_UPDATED", anytime(templateSample.createdAt), orgActor(org), {
      orgId: org.id, targetId: templateSample.id, details: { changes: { color: { from: "#999999", to: templateSample.color } } },
    });
    add("CATEGORY_TEMPLATE_DELETED", anytime(templateSample.createdAt), orgActor(org), { orgId: org.id, targetId: `${templateSample.id}-supprime`, details: { categoryName: "Modèle supprimé" } });
  }

  // ---------- Membres ----------
  for (const m of orgMemberships) {
    const org = world.orgs.find((o) => o.id === m.orgId)!;
    add("MEMBERSHIP_ADDED", after(m.createdAt, 0, HOUR_MS), admin, { orgId: org.id, targetId: m.userId, details: { role: m.role, scope: "org", isNewUser: false } });
  }
  for (const m of eventMemberships) {
    const org = orgOfEvent.get(m.eventId)!;
    add("MEMBERSHIP_ADDED", after(m.createdAt, 0, HOUR_MS), orgActor(org), { orgId: org.id, eventId: m.eventId, targetId: m.userId, details: { role: m.role, scope: "event", isNewUser: false } });
  }
  for (const m of faker.helpers.arrayElements(orgMemberships.filter((x) => x.role !== "OWNER"), Math.min(2, orgMemberships.length))) {
    add("MEMBERSHIP_ROLE_CHANGED", anytime(m.createdAt), admin, { orgId: m.orgId, targetId: m.userId, details: { from: "AUDITOR", to: m.role, scope: "org" } });
  }
  const removed = orgMemberships[0];
  if (removed) {
    add("MEMBERSHIP_REMOVED", anytime(removed.createdAt), admin, { orgId: removed.orgId, targetId: `${removed.userId}-retire`, details: { role: "AUDITOR", scope: "org" } });
  }

  // ---------- Inscriptions : cycle de vie ----------
  const approvedAt = new Map<string, Date>();
  for (const r of registrations) {
    const event = eventById.get(r.eventId)!;
    const org = orgOfEvent.get(r.eventId)!;
    const ids = { orgId: org.id, eventId: r.eventId, targetId: r.id };
    const created = after(r.createdAt, 0, 10 * MINUTE_MS);
    add("REGISTRATION_CREATED", created, { id: r.userId }, { ...ids, details: { categoryName: "Participant" } });
    let last = created;
    if (r.status === "APPROVED" || r.status === "REJECTED") {
      last = after(created, HOUR_MS, 5 * DAY_MS);
      approvedAt.set(r.id, last);
      add(r.status === "APPROVED" ? "REGISTRATION_APPROVED" : "REGISTRATION_REJECTED", last, eventActor(r.eventId), {
        ...ids, details: r.status === "REJECTED" ? { reason: r.rejectionReason ?? "Motif non précisé", eventTitle: event.title } : { eventTitle: event.title },
      });
    }
    if (r.badgePrinted) {
      const printed = r.badgePrintedAt ? clamp(r.badgePrintedAt.getTime()) : after(last, HOUR_MS, 3 * DAY_MS);
      add("BADGE_PRINTED", new Date(Math.max(printed.getTime(), last.getTime())), eventActor(r.eventId), { ...ids, details: { eventTitle: event.title } });
    }
    if (r.allAccessGranted) add("BADGE_ALL_ACCESS_TOGGLED", after(last, HOUR_MS, 2 * DAY_MS), eventActor(r.eventId), { ...ids, details: { allAccess: true } });
  }
  const regSample = (n: number, filter: (r: (typeof registrations)[number]) => boolean = () => true) =>
    faker.helpers.arrayElements(registrations.filter(filter), n);
  const lifecycle = (type: ActivityType, n: number, details: (r: (typeof registrations)[number]) => Prisma.InputJsonValue) => {
    for (const r of regSample(n)) {
      const org = orgOfEvent.get(r.eventId)!;
      const base = approvedAt.get(r.id) ?? r.createdAt;
      add(type, after(base, HOUR_MS, 10 * DAY_MS), type === "REGISTRATION_RESUBMITTED" ? { id: r.userId } : eventActor(r.eventId), {
        orgId: org.id, eventId: r.eventId, targetId: r.id, details: details(r),
      });
    }
  };
  lifecycle("REGISTRATION_UPDATED", ctx.scaled(40, 3), () => ({ changes: { categoryName: { from: "Participant", to: "Intervenant" } } }));
  lifecycle("REGISTRATION_RESUBMITTED", ctx.scaled(20, 2), () => ({ reason: "documents corrigés" }));
  lifecycle("REGISTRATION_SNAPSHOT_REFRESHED", ctx.scaled(15, 2), () => ({ source: "profile" }));
  lifecycle("BADGE_EXPORTED", ctx.scaled(30, 2), () => ({ format: "pdf" }));
  for (const r of regSample(ctx.scaled(60, 3), (x) => x.status === "APPROVED")) {
    const org = orgOfEvent.get(r.eventId)!;
    add("BADGE_SCANNED", after(approvedAt.get(r.id) ?? r.createdAt, HOUR_MS, 14 * DAY_MS), eventActor(r.eventId), {
      orgId: org.id, eventId: r.eventId, targetId: r.id, details: { result: "ok" },
    });
  }
  for (const event of faker.helpers.arrayElements([...eventById.values()].filter((e) => !e.archived), Math.min(eventById.size, ctx.scaled(10, 2)))) {
    const org = orgOfEvent.get(event.id)!;
    const count = rand(5, 40);
    add("BADGE_BATCH_PRINTED", anytime(event.createdAt), eventActor(event.id), { orgId: org.id, eventId: event.id, details: { count } });
    add("BADGE_BATCH_EXPORTED", anytime(event.createdAt), eventActor(event.id), { orgId: org.id, eventId: event.id, details: { count, format: "pdf" } });
  }

  // ---------- Comptes ----------
  for (const u of users) {
    if (u.isStaff) {
      add("USER_CREATED", after(u.createdAt, 0, HOUR_MS), staff[0] ?? null, { targetId: u.id, details: { role: u.staffRole } });
      if (!u.inviteToken && u.passwordResetToken === null) add("USER_PASSWORD_SET", after(u.createdAt, HOUR_MS, DAY_MS), { id: u.id }, { targetId: u.id });
    } else {
      add("USER_REGISTERED", after(u.createdAt, 0, 5 * MINUTE_MS), { id: u.id }, { targetId: u.id });
      if (u.emailVerifiedAt) add("USER_EMAIL_VERIFIED", after(u.createdAt, 5 * MINUTE_MS, HOUR_MS), { id: u.id }, { targetId: u.id });
    }
  }
  const loginable = users.filter((u) => !u.blocked && !u.archived && !u.inviteToken);
  for (let i = 0; i < ctx.scaled(300, 60) && loginable.length > 0; i++) {
    const u = faker.helpers.arrayElement(loginable);
    add("USER_LOGIN", anytime(u.createdAt), { id: u.id }, { targetId: u.id, ip: true });
  }
  const activeUsers = loginable.filter((u) => !u.isStaff);
  for (const [type, n] of [["USER_PASSWORD_RESET_REQUESTED", 6], ["USER_PROFILE_UPDATED", 12], ["USER_UPDATED", 4]] as const) {
    for (const u of faker.helpers.arrayElements(activeUsers, Math.min(activeUsers.length, ctx.scaled(n, 1)))) {
      const at = anytime(u.createdAt);
      add(type, at, type === "USER_UPDATED" ? admin : { id: u.id }, { targetId: u.id });
      if (type === "USER_PASSWORD_RESET_REQUESTED") add("USER_PASSWORD_RESET_COMPLETED", after(at, 5 * MINUTE_MS, HOUR_MS), { id: u.id }, { targetId: u.id });
    }
  }
  const blocked = users.filter((u) => u.blocked);
  for (const u of blocked) add("USER_BLOCKED", anytime(u.createdAt), admin, { targetId: u.id, details: { reason: u.blockedReason ?? "Comportement abusif" } });
  const formerlyBlocked = activeUsers[0];
  if (formerlyBlocked) {
    const at = anytime(formerlyBlocked.createdAt);
    add("USER_BLOCKED", at, admin, { targetId: formerlyBlocked.id, details: { reason: "Signalement" } });
    add("USER_UNBLOCKED", after(at, HOUR_MS, 3 * DAY_MS), admin, { targetId: formerlyBlocked.id });
  }

  // ---------- Profils et motifs ----------
  for (const s of submissions) {
    const submitted = after(s.createdAt, 0, 10 * MINUTE_MS);
    add("PROFILE_SUBMITTED", submitted, { id: s.userId }, { targetId: s.userId });
    if (s.status === "APPROVED" || s.status === "REJECTED") {
      add(s.status === "APPROVED" ? "PROFILE_APPROVED" : "PROFILE_REJECTED",
        s.reviewedAt ? new Date(Math.max(clamp(s.reviewedAt.getTime()).getTime(), submitted.getTime())) : after(submitted, HOUR_MS, 2 * DAY_MS),
        admin, { targetId: s.userId, details: s.status === "REJECTED" ? { reason: s.rejectionReasonLabel ?? "Document illisible" } : undefined });
    }
  }
  for (const reason of reasons) add("REJECTION_REASON_CREATED", after(reason.createdAt, 0, HOUR_MS), admin, { targetId: reason.id, details: { label: reason.label, scope: reason.scope } });
  if (reasons[0]) {
    add("REJECTION_REASON_UPDATED", anytime(reasons[0].createdAt), admin, { targetId: reasons[0].id, details: { changes: { sortOrder: { from: 0, to: reasons[0].sortOrder } } } });
    add("REJECTION_REASON_ARCHIVED", anytime(reasons[0].createdAt), admin, { targetId: `${reasons[0].id}-archive`, details: { label: "Ancien motif" } });
  }

  // ---------- Plateforme ----------
  for (const t of badgeTemplates) add("BADGE_TEMPLATE_INSTALLED", after(t.createdAt, 0, HOUR_MS), admin, { targetId: t.id, details: { family: t.family, version: t.version } });
  add("BADGE_TEMPLATE_ARCHIVED", anytime(), admin, { targetId: "demo-ancien-modele", details: { family: "demo-ancien-modele", version: 1 } });
  for (let i = 0; i < 3; i++) add("PLATFORM_SETTINGS_UPDATED", anytime(), admin, { details: { changes: { onsiteDefaultMarginPercent: { from: 5 * (i + 1), to: 10 } } } });
  const blockedEmail = `spam.${rand(100, 999)}@demo.local`;
  const blockedAt = anytime();
  add("PLATFORM_BLOCKED_EMAIL_ADDED", blockedAt, admin, { targetId: "demo-blocage-email", details: { email: blockedEmail, reason: "Adresse signalée pour abus" } });
  add("PLATFORM_BLOCKED_EMAIL_REMOVED", after(blockedAt, HOUR_MS, 5 * DAY_MS), admin, { targetId: "demo-blocage-email", details: { email: blockedEmail } });
  const blockedDoc = `FAUX-${rand(1000, 9999)}`;
  const docAt = anytime();
  add("PLATFORM_BLOCKED_DOCUMENT_ADDED", docAt, admin, { targetId: "demo-blocage-document", details: { documentNumber: blockedDoc, reason: "Document signalé comme falsifié" } });
  add("PLATFORM_BLOCKED_DOCUMENT_REMOVED", after(docAt, HOUR_MS, 5 * DAY_MS), admin, { targetId: "demo-blocage-document", details: { documentNumber: blockedDoc } });

  // ---------- Jobs ----------
  for (const j of jobs.cancelled) add("JOB_CANCELLED", new Date(Math.max(j.completedAt.getTime() - MINUTE_MS, floor)), admin, { targetId: j.id, details: { kind: j.kind } });
  for (const j of jobs.retried) add("JOB_RETRIED", clamp(j.at.getTime()), admin, { targetId: j.id, details: { kind: j.kind } });
  for (const j of jobs.failed.slice(0, 2)) add("JOB_RETRIED", new Date(Math.min(now, j.completedAt.getTime() + HOUR_MS)), admin, { targetId: j.id, details: { kind: j.kind } });

  await insertInBatches(entries, (data) => prisma.activityLog.createMany({ data }), 1000);
}
