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
  StaffRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

export function makeStaff(role: StaffRole, data: Partial<Prisma.UserUncheckedCreateInput> = {}) {
  return makeUser({ isStaff: true, staffRole: role, ...data });
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
