import type { EventRole, OrgRole, StaffRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

let counter = 0;
function stamp() {
  counter += 1;
  return `${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function makeUser(
  opts: { name?: string; staffRole?: StaffRole; blocked?: boolean; archived?: boolean } = {},
) {
  const s = stamp();
  return prisma.user.create({
    data: {
      email: `n-${s}@x.test`,
      password: "x",
      name: opts.name ?? `User ${s}`,
      isStaff: !!opts.staffRole,
      staffRole: opts.staffRole ?? null,
      blocked: opts.blocked ?? false,
      archived: opts.archived ?? false,
    },
  });
}

export async function makeOrg(name = "Org") {
  const s = stamp();
  return prisma.organization.create({ data: { name, slug: `o-${s}` } });
}

export async function makeEvent(orgId: string, title = "Forum") {
  const s = stamp();
  return prisma.event.create({
    data: { orgId, title, slug: `e-${s}`, location: "L", date: new Date() },
  });
}

export async function addOrgMember(userId: string, orgId: string, role: OrgRole) {
  return prisma.orgMembership.create({ data: { userId, orgId, role } });
}

export async function addEventMember(userId: string, eventId: string, role: EventRole) {
  return prisma.eventMembership.create({ data: { userId, eventId, role } });
}

const COMPLETE_PROFILE = {
  firstName: "Alice",
  lastName: "Doe",
  structure: "ACME",
  photo: "/uploads/photo.png",
  idDocumentType: "CNI",
  idDocumentNumber: "AB1234",
  idDocument: "/uploads/doc.pdf",
};

export async function makeParticipant(over: { profileStatus?: "INCOMPLETE" | "PENDING" | "APPROVED" | "REJECTED" } = {}) {
  const s = stamp();
  return prisma.user.create({
    data: {
      email: `p-${s}@x.test`,
      password: "x",
      name: "Alice Doe",
      emailVerifiedAt: new Date(),
      ...COMPLETE_PROFILE,
      idDocumentNumber: `AB-${s}`,
      participantProfileCompletedAt: new Date(),
      profileStatus: over.profileStatus ?? "APPROVED",
    },
  });
}

export function sessionOf(u: { id: string; email: string; name: string; isStaff: boolean }) {
  return { user: { id: u.id, email: u.email, name: u.name, isStaff: u.isStaff } };
}

// Évènement ouvert avec une équipe complète : owner (OWNER d'org ET ADMIN d'évènement),
// admin, operator, printer, viewer, auditor (AUDITOR d'org) et un participant.
export async function seedTeam() {
  const org = await makeOrg("Acme");
  const plan = await prisma.plan.create({
    data: { name: `plan-${stamp()}`, maxEvents: null, maxParticipantsPerEvent: null },
  });
  await prisma.subscription.create({ data: { orgId: org.id, planId: plan.id, status: "ACTIVE" } });
  const s = stamp();
  const event = await prisma.event.create({
    data: {
      orgId: org.id, title: "Forum", slug: `e-${s}`, location: "L", date: new Date("2026-12-15"),
      registrationOpen: true,
    },
  });
  const category = await prisma.category.create({
    data: { eventId: event.id, name: "Presse", color: "#000000", number: 1 },
  });
  const owner = await makeUser({ name: "Owner" });
  const admin = await makeUser({ name: "Admin" });
  const operator = await makeUser({ name: "Operator" });
  const printer = await makeUser({ name: "Printer" });
  const viewer = await makeUser({ name: "Viewer" });
  const auditor = await makeUser({ name: "Auditor" });
  await addOrgMember(owner.id, org.id, "OWNER");
  await addEventMember(owner.id, event.id, "ADMIN");
  await addEventMember(admin.id, event.id, "ADMIN");
  await addEventMember(operator.id, event.id, "OPERATOR");
  await addEventMember(printer.id, event.id, "PRINTER");
  await addEventMember(viewer.id, event.id, "VIEWER");
  await addOrgMember(auditor.id, org.id, "AUDITOR");
  const participant = await makeParticipant();
  return { org, event, category, owner, admin, operator, printer, viewer, auditor, participant };
}

export async function makeRegistration(
  a: { eventId: string; categoryId: string; user: { id: string; email: string } },
  over: { id?: string; status?: "PENDING" | "APPROVED" | "REJECTED"; rejectionReason?: string | null } = {},
) {
  return prisma.registration.create({
    data: {
      id: over.id ?? `R-${stamp()}`,
      eventId: a.eventId,
      categoryId: a.categoryId,
      userId: a.user.id,
      status: over.status ?? "PENDING",
      rejectionReason: over.rejectionReason ?? null,
      snapshotFirstName: "Alice",
      snapshotLastName: "Doe",
      snapshotEmail: a.user.email,
      snapshotStructure: "ACME",
      snapshotPhoto: "/uploads/photo.png",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "AB1234",
      snapshotIdDocument: "/uploads/doc.pdf",
    },
  });
}

export async function makeNotification(
  userId: string,
  over: {
    scope?: "PLATFORM" | "ORG" | "EVENT" | "PARTICIPANT";
    orgId?: string | null;
    eventId?: string | null;
    readAt?: Date | null;
    createdAt?: Date;
    title?: string;
    links?: unknown;
  } = {},
) {
  return prisma.notification.create({
    data: {
      userId,
      type: "ORG_CREATED",
      scope: over.scope ?? "PLATFORM",
      orgId: over.orgId ?? null,
      eventId: over.eventId ?? null,
      title: over.title ?? "Titre",
      body: "Corps",
      href: "/a",
      links: (over.links ?? [{ label: "A", href: "/a" }]) as never,
      readAt: over.readAt ?? null,
      createdAt: over.createdAt ?? new Date(),
    },
  });
}
