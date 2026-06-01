import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { hashToken } from "@/lib/auth-tokens";

// Convention v2-11 : tous les emails de test E2E suivent ce pattern pour
// permettre le cleanup massif sans toucher aux comptes seedes "permanents".
const E2E_EMAIL_SUFFIX = "@v2-11-e2e.test";

let prismaInstance: PrismaClient | null = null;
function db(): PrismaClient {
  if (!prismaInstance) prismaInstance = new PrismaClient();
  return prismaInstance;
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
  name: string;
};

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
  // Ordre : Registration depend de User, ActivityLog peut referencer un user.
  // On cible uniquement les emails E2E pour ne pas toucher aux comptes seedes.
  const users = await prisma.user.findMany({
    where: { email: { endsWith: E2E_EMAIL_SUFFIX } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length > 0) {
    await prisma.registration.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.activityLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  // Cleanup d'eventuels events de test (slug commencant par e2e-).
  await prisma.event.deleteMany({ where: { slug: { startsWith: "e2e-" } } });
  await prisma.organization.deleteMany({ where: { slug: { startsWith: "e2e-" } } });
}

// Cree un user e2e. Si `verified` = true, emailVerifiedAt pose pour permettre
// le login NextAuth immediatement. Si `profile` = true, le profil participant
// est rempli (l'utilisateur peut s'inscrire a un event).
export async function createTestUser(opts: {
  scope: string;
  verified?: boolean;
  profile?: boolean;
  password?: string;
}): Promise<TestUser> {
  const prisma = db();
  const email = `e2e-${opts.scope}-${Date.now()}-${Math.floor(Math.random() * 1e6)}${E2E_EMAIL_SUFFIX}`;
  const password = opts.password ?? "Test1234!";
  const name = "E2E User";
  const now = new Date();

  const u = await prisma.user.create({
    data: {
      email,
      password: hashSync(password, 12),
      name,
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
}): Promise<{ orgId: string; eventId: string; eventSlug: string; categoryId: string }> {
  const prisma = db();
  const slug = `e2e-${opts.scope}-${Date.now()}`;
  const org = await prisma.organization.create({
    data: { name: "E2E Org", slug: `e2e-org-${opts.scope}-${Date.now()}` },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Salon E2E",
      slug,
      location: "Abidjan",
      date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
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
// Utile pour les E2E qui accedent aux pages /admin/[orgId]/events/[eventId]/*.
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
