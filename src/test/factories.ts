// Fabriques de donnees de test : ecrivent dans la vraie base de test (jamais de mock
// de Prisma). Chaque fabrique accepte des surcharges ; les valeurs uniques portent un
// suffixe (horodatage + compteur) pour eviter les collisions : seules les valeurs faker
// (noms, villes...) sont reproductibles avec `seedFactories(n)`, pas les identifiants.
import { faker } from "@faker-js/faker";
import type {
  PrintMessageKind,
  PrintRequestStatus,
  PrintRequestType,
  PrintThreadSide,
  Prisma,
  RegistrationStatus,
  RoleScope,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Permission } from "@/lib/permissions";
import { legacyKeyOf, systemRoleId } from "@/lib/permissions/db";
import type { SystemRoleKey } from "@/lib/permissions/system-roles";

export type PlatformSystemKey = Extract<
  SystemRoleKey,
  "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_PRINTER" | "STAFF_OBSERVER"
>;
export type OrgSystemKey = Extract<SystemRoleKey, "OWNER" | "MANAGER" | "AUDITOR" | "AGENT">;
export type EventSystemKey = Extract<SystemRoleKey, "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER">;

let counter = 0;
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${faker.string.alphanumeric(4).toLowerCase()}`;

export function seedFactories(seed: number): void {
  faker.seed(seed);
}

export function makeUser(data: Partial<Prisma.UserUncheckedCreateInput> = {}) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return prisma.user.create({
    data: {
      email: `${uid()}@test.local`,
      password: "x",
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      ...data,
    },
  });
}

// Le reset global supprime les rôles : l'id système est résolu (upsert) à chaque appel.
// Double écriture de compatibilité : la colonne d'enum est posée pour les rôles hérités.
export async function makeStaff(role: PlatformSystemKey, data: Partial<Prisma.UserUncheckedCreateInput> = {}) {
  const platformRoleId = await systemRoleId(prisma, role);
  const staffRole = legacyKeyOf<"StaffRole">(role) ?? undefined;
  return makeUser({ isStaff: true, platformRoleId, staffRole, ...data });
}

export async function makeOrgMember(
  orgId: string,
  role: OrgSystemKey,
  data: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  const user = await makeUser(data);
  const roleId = await systemRoleId(prisma, role);
  await prisma.orgMembership.create({
    data: { userId: user.id, orgId, roleId, role: legacyKeyOf<"OrgRole">(role) },
  });
  return user;
}

export async function makeEventMember(
  eventId: string,
  role: EventSystemKey,
  data: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  const user = await makeUser(data);
  const roleId = await systemRoleId(prisma, role);
  await prisma.eventMembership.create({
    data: { userId: user.id, eventId, roleId, role: legacyKeyOf<"EventRole">(role) },
  });
  return user;
}

export function makeCustomRole(input: {
  scope: RoleScope;
  orgId?: string | null;
  name?: string;
  permissions: Permission[];
}) {
  return prisma.role.create({
    data: {
      scope: input.scope,
      orgId: input.orgId ?? null,
      name: input.name ?? `Rôle ${uid()}`,
      permissions: { create: input.permissions.map((permission) => ({ permission })) },
    },
  });
}

export function makeOverride(input: {
  userId: string;
  orgId?: string | null;
  permission: Permission;
  effect: "GRANT" | "REVOKE";
}) {
  return prisma.userPermissionOverride.create({
    data: { userId: input.userId, orgId: input.orgId ?? null, permission: input.permission, effect: input.effect },
  });
}

export function makeOrg(data: Partial<Prisma.OrganizationUncheckedCreateInput> = {}) {
  return prisma.organization.create({
    data: { name: faker.company.name(), slug: `org-${uid()}`, ...data },
  });
}

export function makeEvent(orgId: string, data: Partial<Prisma.EventUncheckedCreateInput> = {}) {
  return prisma.event.create({
    data: {
      orgId,
      title: faker.lorem.words(3),
      slug: `ev-${uid()}`,
      location: faker.location.city(),
      date: faker.date.soon({ days: 60 }),
      ...data,
    },
  });
}

export function makePlan(data: Partial<Prisma.PlanUncheckedCreateInput> = {}) {
  return prisma.plan.create({
    data: { name: `Plan ${uid()}`, maxEvents: 10, maxParticipantsPerEvent: 1000, ...data },
  });
}

export function makePayment(orgId: string, data: Partial<Prisma.PaymentUncheckedCreateInput> = {}) {
  return prisma.payment.create({
    data: { orgId, amount: faker.number.int({ min: 1000, max: 50000 }), ...data },
  });
}

export async function makeCategory(eventId: string, data: Partial<Prisma.CategoryUncheckedCreateInput> = {}) {
  const number = data.number ?? (await prisma.category.count({ where: { eventId } })) + 1;
  return prisma.category.create({
    data: { eventId, name: faker.word.noun(), color: faker.color.rgb(), number, ...data },
  });
}

export async function makeRegistration(
  eventId: string,
  categoryId: string,
  status: RegistrationStatus = "APPROVED",
  data: Partial<Prisma.RegistrationUncheckedCreateInput> = {},
) {
  const user = data.userId ? null : await makeUser();
  const userId = data.userId ?? user!.id;
  return prisma.registration.create({
    data: {
      id: `REG-${uid()}`.toUpperCase(),
      eventId,
      categoryId,
      userId,
      status,
      snapshotFirstName: user?.firstName ?? faker.person.firstName(),
      snapshotLastName: user?.lastName ?? faker.person.lastName(),
      snapshotEmail: user?.email ?? `${uid()}@test.local`,
      snapshotStructure: faker.company.name(),
      snapshotPhoto: "uploads/test/photo.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: faker.string.alphanumeric(10).toUpperCase(),
      snapshotIdDocument: "uploads/test/cni.pdf",
      ...data,
    },
  });
}

export function makeInstalledTemplate(
  installedById: string,
  data: Partial<Prisma.InstalledBadgeTemplateUncheckedCreateInput> & { pages?: 1 | 2 } = {},
) {
  const pages = data.pages ?? 1;
  const family = `test-${uid()}`;
  const label = data.label ?? `Badge ${faker.word.adjective()}`;
  return prisma.installedBadgeTemplate.create({
    data: {
      family,
      version: 1,
      label,
      description: "",
      pages,
      pageWidthPx: 320,
      pageHeightPx: 460,
      layout: { formatVersion: 3, family, label, page: { widthPx: 320, heightPx: 460, count: pages }, variables: [], blocks: [] },
      bindings: {},
      assetPrefix: `badge-templates/${family}/`,
      formatVersion: 3,
      installedById,
      ...data,
    },
  });
}

export function makePrintLayout(data: Partial<Prisma.PrintSheetLayoutUncheckedCreateInput> = {}) {
  return prisma.printSheetLayout.create({
    data: {
      name: `Gabarit ${uid()}`,
      sheetWidth: 2970,
      sheetHeight: 4200,
      sheetOrientation: "PORTRAIT",
      marginTop: 100,
      marginRight: 100,
      marginBottom: 100,
      marginLeft: 100,
      gapHorizontal: 50,
      gapVertical: 50,
      ...data,
    },
  });
}

export function makePrintOrder(input: {
  eventId: string;
  orgId: string;
  status?: PrintRequestStatus;
  type?: PrintRequestType;
  data?: Partial<Prisma.PrintRequestUncheckedCreateInput>;
}) {
  return prisma.printRequest.create({
    data: {
      reference: `CMD-${uid()}`.toUpperCase(),
      eventId: input.eventId,
      orgId: input.orgId,
      type: input.type ?? "ADVANCE",
      status: input.status ?? "SUBMITTED",
      ...input.data,
    },
  });
}

export function makePrintMessage(input: {
  requestId: string;
  authorId?: string | null;
  side?: PrintThreadSide;
  kind?: PrintMessageKind;
  internal?: boolean;
  createdAt?: Date;
  body?: string;
}) {
  const kind = input.kind ?? "MESSAGE";
  return prisma.printRequestMessage.create({
    data: {
      requestId: input.requestId,
      authorId: input.authorId ?? null,
      side: input.side ?? (input.authorId ? "ORGANIZER" : "SYSTEM"),
      kind,
      body: input.body ?? faker.lorem.sentence(),
      eventType: kind === "EVENT" ? "STATUS_CHANGED" : null,
      internal: input.internal ?? false,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}

export function makePrintGeneration(input: {
  eventId: string;
  printRequestId?: string | null;
  layoutId?: string | null;
  data?: Partial<Prisma.PrintSheetGenerationUncheckedCreateInput>;
}) {
  return prisma.printSheetGeneration.create({
    data: {
      eventId: input.eventId,
      printRequestId: input.printRequestId ?? null,
      layoutId: input.layoutId ?? null,
      registrationIds: [],
      ...input.data,
    },
  });
}
