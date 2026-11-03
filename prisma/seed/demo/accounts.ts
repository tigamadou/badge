import type { EventRole, OrgRole, StaffRole } from "@prisma/client";
import { prisma } from "../../../src/lib/prisma";
import { DEMO_DOMAIN, DEV_SUPER_ADMIN_EMAIL } from "../constants";
import type { DemoContext, DemoSpecialCase, DemoUser, EventPhase } from "./context";

type Seed = {
  email: string;
  role: string;
  scenario: string;
  staffRole?: StaffRole;
  data?: Record<string, unknown>;
  /** Clé du registre `special` ou rattachements à matérialiser plus tard. */
  special?: DemoSpecialCase;
  orgs?: Array<{ slug: string; role: OrgRole }>;
  events?: Array<{ slug: string; role: EventRole; phase: EventPhase | "any" }>;
  participant?: boolean;
};

const GROSSE = "demo-grosse-org";
const MOYENNE = "demo-moyenne-1";
const PETITE = "demo-petite-1";
const ARCHIVEE = "demo-archivee";

const email = (local: string) => `${local}${DEMO_DOMAIN}`;

function buildSeeds(ctx: DemoContext): Seed[] {
  const { dates, faker } = ctx;
  const token = () => faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" });
  const verified = { emailVerifiedAt: dates.now };

  const staff = (local: string, staffRole: StaffRole, scenario: string, full = email(local)): Seed => ({
    email: full, role: staffRole, scenario, staffRole, data: { isStaff: true, ...verified },
  });
  const orgMember = (local: string, role: OrgRole, scenario: string, orgs: Seed["orgs"], extra: Partial<Seed> = {}): Seed => ({
    email: email(local), role, scenario, orgs, data: { ...verified }, ...extra,
  });
  const eventMember = (local: string, role: EventRole, scenario: string, events: Seed["events"]): Seed => ({
    email: email(local), role, scenario, events, data: { ...verified },
  });

  return [
    staff("admin2", "SUPER_ADMIN", "Super administrateur secondaire", "admin2@badge.local"),
    staff("staff-admin", "STAFF_ADMIN", "Administrateur plateforme"),
    staff("staff-admin.2", "STAFF_ADMIN", "Administrateur plateforme (second compte)"),
    staff("support", "STAFF_SUPPORT", "Support plateforme", "support@badge.local"),
    staff("support.2", "STAFF_SUPPORT", "Support plateforme (second compte)"),
    staff("observer", "STAFF_OBSERVER", "Observateur plateforme en lecture seule", "observer@badge.local"),
    staff("observer", "STAFF_OBSERVER", "Observateur plateforme (compte de démo)"),

    orgMember("owner.grosse-org", "OWNER", "Propriétaire de la grosse organisation", [{ slug: GROSSE, role: "OWNER" }]),
    orgMember("owner.2.grosse-org", "OWNER", "Second propriétaire de la grosse organisation", [{ slug: GROSSE, role: "OWNER" }]),
    orgMember("manager.grosse-org", "MANAGER", "Gestionnaire de la grosse organisation", [{ slug: GROSSE, role: "MANAGER" }]),
    orgMember("auditor.grosse-org", "AUDITOR", "Auditeur de la grosse organisation", [{ slug: GROSSE, role: "AUDITOR" }]),
    orgMember("owner.moyenne-1", "OWNER", "Propriétaire d'une organisation moyenne", [{ slug: MOYENNE, role: "OWNER" }]),
    orgMember("manager.moyenne-1", "MANAGER", "Gestionnaire d'une organisation moyenne", [{ slug: MOYENNE, role: "MANAGER" }]),
    orgMember("owner.petite-1", "OWNER", "Propriétaire d'une petite organisation", [{ slug: PETITE, role: "OWNER" }]),
    orgMember("auditor.petite-1", "AUDITOR", "Auditeur d'une petite organisation", [{ slug: PETITE, role: "AUDITOR" }]),
    orgMember("owner.archivee", "OWNER", "Propriétaire d'une organisation archivée", [{ slug: ARCHIVEE, role: "OWNER" }]),
    orgMember("manager.multi-org", "MANAGER", "Membre de deux organisations", [
      { slug: GROSSE, role: "MANAGER" },
      { slug: PETITE, role: "MANAGER" },
    ], { special: "multiOrg" }),
    orgMember("manager.participant", "MANAGER", "Organisateur également participant", [{ slug: PETITE, role: "MANAGER" }], {
      special: "organizerAndParticipant",
      participant: true,
    }),

    eventMember("event-admin", "ADMIN", "Administrateur d'évènement", [{ slug: GROSSE, role: "ADMIN", phase: "any" }]),
    eventMember("event-operator", "OPERATOR", "Opérateur d'un évènement en cours", [{ slug: GROSSE, role: "OPERATOR", phase: "ongoing" }]),
    eventMember("event-printer", "PRINTER", "Imprimeur d'un évènement en cours", [{ slug: GROSSE, role: "PRINTER", phase: "ongoing" }]),
    eventMember("event-viewer", "VIEWER", "Lecteur d'évènement", [{ slug: MOYENNE, role: "VIEWER", phase: "any" }]),

    {
      email: email("invitation.pending"), role: "STAFF_SUPPORT", scenario: "Invitation staff en attente",
      special: "invitationPending", staffRole: "STAFF_SUPPORT",
      data: { isStaff: true, inviteToken: token(), inviteTokenExpiry: dates.daysFromNow(7) },
    },
    {
      email: email("invitation.expired"), role: "STAFF_SUPPORT", scenario: "Invitation staff expirée",
      special: "invitationExpired", staffRole: "STAFF_SUPPORT",
      data: { isStaff: true, inviteToken: token(), inviteTokenExpiry: dates.daysAgo(3) },
    },
    {
      email: email("invitation.accepted"), role: "STAFF_OBSERVER", scenario: "Invitation staff acceptée",
      special: "invitationAccepted", staffRole: "STAFF_OBSERVER",
      data: { isStaff: true, ...verified, lastLoginAt: dates.daysAgo(1) },
    },
    {
      email: email("participant.blocked"), role: "PARTICIPANT", scenario: "Compte bloqué (motif renseigné)",
      special: "blocked",
      data: { ...verified, blocked: true, blockedReason: "Documents d'identité falsifiés signalés par l'organisateur" },
    },
    {
      email: email("participant.unverified"), role: "PARTICIPANT", scenario: "Email non vérifié",
      special: "unverifiedEmail",
      data: { emailVerifyToken: token(), emailVerifyTokenExpiry: dates.daysFromNow(1) },
    },
    {
      email: email("participant.archived"), role: "PARTICIPANT", scenario: "Compte archivé",
      special: "archivedUser",
      data: { ...verified, archived: true, archivedAt: dates.daysAgo(15) },
    },
  ];
}

export async function seedAccounts(ctx: DemoContext): Promise<void> {
  const { registry, faker } = ctx;
  const seeds = buildSeeds(ctx);

  // Les emails doivent rester uniques : le seed en dur ci-dessus ne doit jamais se recouper.
  const emails = seeds.map((s) => s.email);
  if (new Set(emails).size !== emails.length) throw new Error("Emails de demo dupliques dans seedAccounts");

  const rows = seeds.map((s) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      email: s.email,
      password: ctx.passwordHash,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      ...(s.staffRole ? { staffRole: s.staffRole } : {}),
      ...s.data,
    };
  });
  await prisma.user.createMany({ data: rows as never });

  const created = await prisma.user.findMany({ where: { email: { in: emails } } });
  const byEmail = new Map(created.map((u) => [u.email, u]));
  const asDemo = (u: { id: string; email: string; name: string }): DemoUser => ({ id: u.id, email: u.email, name: u.name });

  // Le SUPER_ADMIN de dev (cree par le seed minimal) est conserve tel quel.
  const root = await prisma.user.findUnique({ where: { email: DEV_SUPER_ADMIN_EMAIL } });
  if (root) {
    registry.staff.SUPER_ADMIN.push(asDemo(root));
    ctx.recordAccount(root.email, "SUPER_ADMIN", "Super administrateur de développement");
  }

  for (const s of seeds) {
    const user = asDemo(byEmail.get(s.email)!);
    ctx.recordAccount(s.email, s.role, s.scenario);
    const isInvite = s.special?.startsWith("invitation");
    if (s.staffRole && !isInvite) registry.staff[s.staffRole].push(user);
    if (s.special) registry.special[s.special] = user;
    for (const o of s.orgs ?? []) registry.pendingOrgMembers.push({ user, role: o.role, orgSlug: o.slug });
    for (const e of s.events ?? []) {
      registry.pendingEventMembers.push({ user, role: e.role, orgSlug: e.slug, phase: e.phase });
    }
    if (s.participant) await approveProfile(ctx, user);
  }
}

// Profil valide (APPROVED + derniere soumission APPROVED) : requis pour s'inscrire.
async function approveProfile(ctx: DemoContext, user: DemoUser): Promise<void> {
  const photo = ctx.images.photos[0];
  const idDocument = ctx.images.photos[1] ?? photo;
  const submission = {
    photo, idDocumentType: "CNI", idDocumentNumber: ctx.faker.string.numeric(9), idDocument,
  };
  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...submission,
      structure: ctx.faker.company.name(),
      participantProfileCompletedAt: ctx.dates.daysAgo(30),
      profileStatus: "APPROVED",
    },
  });
  await prisma.profileSubmission.create({
    data: { userId: user.id, ...submission, status: "APPROVED", reviewedAt: ctx.dates.daysAgo(29) },
  });
  ctx.registry.participants.push(user);
}
