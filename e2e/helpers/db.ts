import { PrismaClient, RegistrationStatus } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { hashToken } from "@/lib/auth-tokens";

// Convention v2-11 : tous les emails de test E2E suivent ce pattern pour
// permettre le cleanup massif sans toucher aux comptes seedes "permanents".
// Conserve tel quel meme apres v2-13 pour assurer un cleanup partage entre specs.
const E2E_EMAIL_SUFFIX = "@v2-11-e2e.test";

let prismaInstance: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prismaInstance) prismaInstance = new PrismaClient();
  return prismaInstance;
}

// Expose l'instance Prisma singleton pour les autres helpers e2e (audit.ts).
// Evite de creer plusieurs PrismaClient par run.
export function getDb(): PrismaClient {
  return db();
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
  name: string;
};

export type TestStaffRole = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";
export type TestOrgRole = "OWNER" | "MANAGER" | "AUDITOR";
export type TestEventRole = "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER";

const FULL_PROFILE = {
  firstName: "Awa",
  lastName: "Diallo",
  structure: "ENSEA",
  photo: "uploads/profile/e2e/awa-photo.jpg",
  idDocumentType: "CNI",
  idDocumentNumber: "CI-E2E-001",
  idDocument: "uploads/profile/e2e/awa-cni.pdf",
} as const;

export async function cleanupE2ETestData(): Promise<void> {
  const prisma = db();

  // 1. Recuperer les users E2E (suffixe convention).
  const users = await prisma.user.findMany({
    where: { email: { endsWith: E2E_EMAIL_SUFFIX } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  // 2. Recuperer les events et orgs E2E (prefixe slug).
  const events = await prisma.event.findMany({
    where: { slug: { startsWith: "e2e-" } },
    select: { id: true, orgId: true },
  });
  const eventIds = events.map((e) => e.id);

  const orgs = await prisma.organization.findMany({
    where: { slug: { startsWith: "e2e-" } },
    select: { id: true },
  });
  const orgIds = orgs.map((o) => o.id);

  // 3. Cleanup dans l'ordre des FK :
  //    Registration -> EventMembership/OrgMembership -> Category/Blocked* ->
  //    CategoryTemplate -> ActivityLog -> User -> Event -> Organization.
  if (userIds.length > 0) {
    await prisma.profileSubmission.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.registration.deleteMany({ where: { userId: { in: userIds } } });
  }
  // v4 (plan 08) : motifs de rejet E2E (prefixe de libelle).
  await prisma.rejectionReason.deleteMany({ where: { label: { startsWith: "E2E motif " } } });
  // v4 (plan 11) : templates installes par les tests (prefixe de famille).
  await prisma.installedBadgeTemplate.deleteMany({ where: { family: { startsWith: "e2e-" } } });
  if (eventIds.length > 0) {
    await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.eventMembership.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.category.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.blockedEmail.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.blockedDocument.deleteMany({ where: { eventId: { in: eventIds } } });
  }
  if (userIds.length > 0) {
    await prisma.eventMembership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.orgMembership.deleteMany({ where: { userId: { in: userIds } } });
  }
  if (orgIds.length > 0) {
    await prisma.orgMembership.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.categoryTemplate.deleteMany({ where: { orgId: { in: orgIds } } });
  }

  // ActivityLog : on cible userId, orgId et eventId E2E. Pas de cascade auto cote Prisma
  // (relation optionnelle SetNull), donc on supprime explicitement pour ne pas laisser
  // de logs orphelins entre runs.
  if (userIds.length > 0 || eventIds.length > 0 || orgIds.length > 0) {
    await prisma.activityLog.deleteMany({
      where: {
        OR: [
          ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
          ...(eventIds.length > 0 ? [{ eventId: { in: eventIds } }] : []),
          ...(orgIds.length > 0 ? [{ orgId: { in: orgIds } }] : []),
        ],
      },
    });
  }

  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  if (eventIds.length > 0) {
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  }
  if (orgIds.length > 0) {
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }
}

// Cree un user e2e. Si `verified` = true, emailVerifiedAt pose pour permettre
// le login NextAuth immediatement. Si `profile` = true, le profil participant
// est rempli (l'utilisateur peut s'inscrire a un event).
export async function createTestUser(opts: {
  scope: string;
  verified?: boolean;
  profile?: boolean;
  password?: string;
  // v4 (plan 08) : par defaut un profil complet est considere APPROVED (les specs
  // d'inscription supposent un profil valide). Passer explicitement pour tester le gate.
  profileStatus?: "INCOMPLETE" | "PENDING" | "APPROVED" | "REJECTED";
}): Promise<TestUser> {
  const prisma = db();
  const email = `e2e-${opts.scope}-${Date.now()}-${Math.floor(Math.random() * 1e6)}${E2E_EMAIL_SUFFIX}`;
  const password = opts.password ?? "Test1234!";
  const name = "E2E User";
  const now = new Date();

  const profileStatus = opts.profileStatus ?? (opts.profile ? "APPROVED" : "INCOMPLETE");

  const u = await prisma.user.create({
    data: {
      email,
      password: hashSync(password, 12),
      name,
      profileStatus,
      ...(opts.verified ? { emailVerifiedAt: now } : {}),
      ...(opts.profile
        ? {
            ...FULL_PROFILE,
            participantProfileCompletedAt: now,
          }
        : {}),
    },
    select: { id: true, email: true, name: true },
  });
  return { id: u.id, email: u.email, password, name: u.name };
}

// v4 (plan 08) : cree une soumission de profil E2E pour un user donne.
export async function createTestProfileSubmission(opts: {
  userId: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReasonLabel?: string;
  rejectionDetails?: string;
  photo?: string;
  createdAt?: Date;
}): Promise<{ id: string }> {
  const prisma = db();
  const s = await prisma.profileSubmission.create({
    data: {
      userId: opts.userId,
      photo: opts.photo ?? "profile/e2e/photos/p.png",
      idDocumentType: "CNI",
      idDocumentNumber: "E2E-DOC-1",
      idDocument: "profile/e2e/documents/d.pdf",
      status: opts.status ?? "PENDING",
      rejectionReasonLabel: opts.rejectionReasonLabel ?? null,
      rejectionDetails: opts.rejectionDetails ?? null,
      reviewedAt: opts.status && opts.status !== "PENDING" ? new Date() : null,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
    select: { id: true },
  });
  return s;
}

// v4 (plan 08) : cree un motif de rejet E2E (nettoye par cleanupE2ETestData via le
// prefixe de libelle).
export async function createTestRejectionReason(opts: {
  scope: "PROFILE" | "REGISTRATION" | "BOTH";
  label?: string;
  sortOrder?: number;
}): Promise<{ id: string; label: string }> {
  const prisma = db();
  const label = opts.label ?? `E2E motif ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await prisma.rejectionReason.create({
    data: { label, scope: opts.scope, sortOrder: opts.sortOrder ?? 0 },
    select: { id: true, label: true },
  });
  return r;
}

// Cree un user staff verifie avec isStaff=true et staffRole pose.
export async function createTestStaff(opts: {
  scope: string;
  role: TestStaffRole;
}): Promise<TestUser> {
  const prisma = db();
  const base = await createTestUser({ scope: `staff-${opts.scope}`, verified: true });
  await prisma.user.update({
    where: { id: base.id },
    data: { isStaff: true, staffRole: opts.role },
  });
  return base;
}

// Cree une organisation + un user OWNER + l'OrgMembership OWNER associee.
// Ne cree aucun event ; c'est le minimum pour tester les flows org-only.
export async function createTestOrgWithOwner(opts: {
  scope: string;
  // Limites du plan attache a l'org (null/omis = illimite).
  // maxParticipantsPerEvent est une limite de participants PAR EVENT (abonnements v4).
  maxEvents?: number;
  maxParticipantsPerEvent?: number;
  // Periodicite portee par le plan (defaut MONTHLY).
  planPeriod?: "MONTHLY" | "ANNUAL";
  // false = aucun abonnement attache (org bloquee). Defaut true.
  activeSubscription?: boolean;
}): Promise<{ orgId: string; owner: TestUser }> {
  const prisma = db();
  const slugSuffix = `${opts.scope}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const org = await prisma.organization.create({
    data: {
      name: `E2E Org ${opts.scope}`,
      slug: `e2e-org-${slugSuffix}`,
    },
  });
  if (opts.activeSubscription ?? true) {
    const plan = await prisma.plan.create({
      data: {
        name: `e2e-plan-${slugSuffix}`,
        period: opts.planPeriod ?? "MONTHLY",
        maxEvents: opts.maxEvents ?? null,
        maxParticipantsPerEvent: opts.maxParticipantsPerEvent ?? null,
      },
    });
    await prisma.subscription.create({
      data: { orgId: org.id, planId: plan.id, status: "ACTIVE" },
    });
  }
  const owner = await createTestUser({ scope: `org-owner-${opts.scope}`, verified: true });
  await prisma.orgMembership.create({
    data: { userId: owner.id, orgId: org.id, role: "OWNER" },
  });
  return { orgId: org.id, owner };
}

// Cree un user verifie + OrgMembership pour le role demande sur une org existante.
export async function createTestOrgMember(opts: {
  scope: string;
  orgId: string;
  role: TestOrgRole;
}): Promise<TestUser> {
  const prisma = db();
  const user = await createTestUser({ scope: `orgm-${opts.scope}`, verified: true });
  await prisma.orgMembership.create({
    data: { userId: user.id, orgId: opts.orgId, role: opts.role },
  });
  return user;
}

// Cree un user verifie avec un EventMembership pour le role demande.
//
// IMPORTANT : par defaut on NE pose PAS d'OrgMembership AUDITOR. La fonction
// `effectiveEventRole` resout l'OrgMembership AVANT l'EventMembership, donc un
// AUDITOR org ecraserait silencieusement le role event (OPERATOR/PRINTER
// deviendraient VIEWER effectivement). Les tests qui ciblent un role event
// precis doivent garder le user "event-only".
//
// Pour les tests historiques (v2-11 RBAC) qui s'appuyaient sur l'ancien
// comportement (AUDITOR org pose), passer `attachOrgAuditor: true`.
export async function createTestEventMember(opts: {
  scope: string;
  eventId: string;
  orgId: string;
  role: TestEventRole;
  attachOrgAuditor?: boolean;
}): Promise<TestUser> {
  const prisma = db();
  const user = await createTestUser({ scope: `evm-${opts.scope}`, verified: true });
  if (opts.attachOrgAuditor) {
    await prisma.orgMembership.create({
      data: { userId: user.id, orgId: opts.orgId, role: "AUDITOR" },
    });
  }
  await prisma.eventMembership.create({
    data: { userId: user.id, eventId: opts.eventId, role: opts.role },
  });
  return user;
}

// Cree une registration avec snapshot pris depuis le profil courant du user.
// Le user doit avoir un profil complet (firstName, lastName, etc.) -- si l'un
// des champs est absent, on utilise un fallback E2E.
export async function createTestRegistration(opts: {
  eventId: string;
  userId: string;
  categoryId: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}): Promise<{ id: string }> {
  const prisma = db();
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      structure: true,
      photo: true,
      idDocumentType: true,
      idDocumentNumber: true,
      idDocument: true,
    },
  });
  if (!user) {
    throw new Error(`createTestRegistration: user ${opts.userId} introuvable`);
  }
  const id = `E2E-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await prisma.registration.create({
    data: {
      id,
      userId: opts.userId,
      eventId: opts.eventId,
      categoryId: opts.categoryId,
      status: opts.status ?? "PENDING",
      snapshotFirstName: user.firstName ?? FULL_PROFILE.firstName,
      snapshotLastName: user.lastName ?? FULL_PROFILE.lastName,
      snapshotEmail: user.email,
      snapshotStructure: user.structure ?? FULL_PROFILE.structure,
      snapshotPhoto: user.photo ?? FULL_PROFILE.photo,
      snapshotIdDocumentType: user.idDocumentType ?? FULL_PROFILE.idDocumentType,
      snapshotIdDocumentNumber: user.idDocumentNumber ?? FULL_PROFILE.idDocumentNumber,
      snapshotIdDocument: user.idDocument ?? FULL_PROFILE.idDocument,
    },
  });
  return { id };
}

// Cree une categorie sur un event. Si `number` n'est pas fourni, on calcule
// le prochain disponible sur l'event pour eviter une collision sur la
// contrainte unique (eventId, number).
export async function createTestCategory(opts: {
  eventId: string;
  name?: string;
  color?: string;
  number?: number;
  neutralBadge?: boolean;
  anonymous?: boolean;
}): Promise<{ id: string }> {
  const prisma = db();
  let number = opts.number;
  if (number === undefined) {
    const max = await prisma.category.aggregate({
      where: { eventId: opts.eventId },
      _max: { number: true },
    });
    number = (max._max.number ?? 0) + 1;
  }
  const scopeSuffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const cat = await prisma.category.create({
    data: {
      eventId: opts.eventId,
      name: opts.name ?? `Visiteur-${scopeSuffix}`,
      color: opts.color ?? "#4f46e5",
      number,
      neutralBadge: opts.neutralBadge ?? false,
      anonymous: opts.anonymous ?? false,
    },
    select: { id: true },
  });
  return cat;
}

// Cree un CategoryTemplate sur une org. Idem createTestCategory pour le number.
export async function createTestCategoryTemplate(opts: {
  orgId: string;
  name?: string;
  color?: string;
  number?: number;
}): Promise<{ id: string }> {
  const prisma = db();
  let number = opts.number;
  if (number === undefined) {
    const max = await prisma.categoryTemplate.aggregate({
      where: { orgId: opts.orgId },
      _max: { number: true },
    });
    number = (max._max.number ?? 0) + 1;
  }
  const scopeSuffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const tpl = await prisma.categoryTemplate.create({
    data: {
      orgId: opts.orgId,
      name: opts.name ?? `Template-${scopeSuffix}`,
      color: opts.color ?? "#4f46e5",
      number,
    },
    select: { id: true },
  });
  return tpl;
}

export async function createTestBlockedEmail(opts: {
  eventId: string;
  email: string;
  reason?: string;
}): Promise<void> {
  await db().blockedEmail.create({
    data: {
      eventId: opts.eventId,
      email: opts.email,
      reason: opts.reason ?? null,
    },
  });
}

export async function createTestBlockedDocument(opts: {
  eventId: string;
  documentNumber: string;
  reason?: string;
}): Promise<void> {
  await db().blockedDocument.create({
    data: {
      eventId: opts.eventId,
      documentNumber: opts.documentNumber,
      reason: opts.reason ?? null,
    },
  });
}

export async function setRegistrationStatus(
  regId: string,
  status: "PENDING" | "APPROVED" | "REJECTED",
  opts?: { rejectionReason?: string; rejectionDetails?: string },
): Promise<void> {
  // On utilise l'enum Prisma pour rester strict.
  const data: { status: RegistrationStatus; rejectionReason?: string | null; rejectionDetails?: string | null } = {
    status: status as RegistrationStatus,
  };
  if (status === "REJECTED") {
    data.rejectionReason = opts?.rejectionReason ?? null;
    data.rejectionDetails = opts?.rejectionDetails ?? null;
  } else {
    // Si on repasse PENDING/APPROVED, on efface le motif de rejet pour rester coherent.
    data.rejectionReason = null;
    data.rejectionDetails = null;
  }
  await db().registration.update({ where: { id: regId }, data });
}

// Pose un emailVerifyToken connu sur un user existant. Retourne le token plain
// (a passer dans l'URL /verify-email/[token]). Le hash est stocke en BDD.
export async function seedEmailVerifyToken(userId: string): Promise<string> {
  const prisma = db();
  const plain = `e2e-verify-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifyToken: hashToken(plain),
      emailVerifyTokenExpiry: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });
  return plain;
}

export async function seedPasswordResetToken(userId: string): Promise<string> {
  const prisma = db();
  const plain = `e2e-reset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetToken: hashToken(plain),
      passwordResetExpiry: new Date(Date.now() + 3600 * 1000),
    },
  });
  return plain;
}

// Pose un inviteToken connu sur un user existant (flow /setup-password).
// L'expiry par defaut suit la convention v2-11 (24h).
export async function seedInviteToken(
  userId: string,
  opts?: { expiresInHours?: number },
): Promise<string> {
  const prisma = db();
  const plain = `e2e-invite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ttlMs = (opts?.expiresInHours ?? 24) * 3600 * 1000;
  await prisma.user.update({
    where: { id: userId },
    data: {
      inviteToken: hashToken(plain),
      inviteTokenExpiry: new Date(Date.now() + ttlMs),
    },
  });
  return plain;
}

export async function getUserById(userId: string) {
  return db().user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerifiedAt: true,
      participantProfileCompletedAt: true,
      firstName: true,
      lastName: true,
      structure: true,
    },
  });
}

// Cree un event public ouvert avec une categorie, pour les E2E qui exigent
// un parcours complet d'inscription.
export async function createTestEvent(opts: {
  scope: string;
  date?: Date;
  endDate?: Date;
  description?: string;
}): Promise<{ orgId: string; eventId: string; eventSlug: string; categoryId: string }> {
  const prisma = db();
  const slug = `e2e-${opts.scope}-${Date.now()}`;
  const org = await prisma.organization.create({
    data: { name: "E2E Org", slug: `e2e-org-${opts.scope}-${Date.now()}` },
  });
  const plan = await prisma.plan.create({
    data: { name: `e2e-plan-${opts.scope}-${Date.now()}`, maxEvents: null, maxParticipantsPerEvent: null },
  });
  await prisma.subscription.create({
    data: { orgId: org.id, planId: plan.id, status: "ACTIVE" },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Salon E2E",
      slug,
      location: "Abidjan",
      date: opts.date ?? new Date(Date.now() + 30 * 24 * 3600 * 1000),
      endDate: opts.endDate ?? null,
      description: opts.description ?? null,
      registrationOpen: true,
    },
  });
  const category = await prisma.category.create({
    data: {
      eventId: event.id,
      name: "Visiteur",
      color: "#4f46e5",
      number: 1,
    },
  });
  return { orgId: org.id, eventId: event.id, eventSlug: event.slug, categoryId: category.id };
}

// v2-12 : cree un user staff avec EventMembership ADMIN sur un event donne.
// Utile pour les E2E qui accedent aux pages /org/[orgId]/event/[eventId]/*.
export async function makeEventAdminUser(opts: {
  scope: string;
  eventId: string;
  orgId: string;
}): Promise<TestUser> {
  const prisma = db();
  const user = await createTestUser({ scope: opts.scope, verified: true });
  await prisma.orgMembership.create({
    data: { userId: user.id, orgId: opts.orgId, role: "OWNER" },
  });
  await prisma.eventMembership.create({
    data: { userId: user.id, eventId: opts.eventId, role: "ADMIN" },
  });
  return user;
}

export async function getEventBadgeTemplateId(eventId: string): Promise<string | null> {
  const e = await db().event.findUnique({
    where: { id: eventId },
    select: { badgeTemplateId: true },
  });
  return e?.badgeTemplateId ?? null;
}

export async function getLatestRegistrationForUser(userId: string) {
  return db().registration.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      eventId: true,
      snapshotFirstName: true,
      snapshotLastName: true,
      snapshotStructure: true,
    },
  });
}

// Force le statut REJECTED d'une registration (et un editToken... non, plus en
// v2-11 : on met juste un motif de rejet pour preparer le test resubmit).
export async function rejectRegistration(registrationId: string, reason: string): Promise<void> {
  await db().registration.update({
    where: { id: registrationId },
    data: { status: "REJECTED", rejectionReason: reason },
  });
}

export async function disconnectDb(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
