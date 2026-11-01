import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function user(name: string, staffRole?: "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER") {
  return prisma.user.create({
    data: {
      email: `${uniq(name)}@x.test`,
      password: "x",
      name,
      ...(staffRole ? { isStaff: true, staffRole } : {}),
    },
  });
}

let regCounter = 0;
async function registration(
  eventId: string,
  categoryId: string,
  status: "APPROVED" | "PENDING",
  last: string,
) {
  regCounter += 1;
  const participant = await user(`participant${regCounter}`);
  return prisma.registration.create({
    data: {
      id: uniq(`REG${regCounter}`),
      userId: participant.id,
      eventId,
      categoryId,
      status,
      snapshotFirstName: "Prenom",
      snapshotLastName: last,
      snapshotEmail: `${uniq("r")}@x.test`,
      snapshotStructure: "S",
      snapshotPhoto: "",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "1",
      snapshotIdDocument: "",
    } as never,
  });
}

// Jeu de données commun aux tests des demandes d'impression : une organisation, un évènement
// (template 320 x 460 px, 2 pages), des membres de chaque rôle, des inscriptions et des produits.
export async function seedPrintFixture() {
  const org = await prisma.organization.create({ data: { name: "Org", slug: uniq("org") } });
  const template = await prisma.installedBadgeTemplate.create({
    data: {
      family: uniq("print-fixture"), version: 1, label: "Badge test", description: "",
      pages: 2, pageWidthPx: 320, pageHeightPx: 460, layout: { variables: [] }, bindings: {},
      assetPrefix: "badge-templates/print-fixture/", formatVersion: 3, installedById: "u1",
    },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id, title: "Evenement", slug: uniq("evt"), location: "Niamey", date: new Date(),
      badgeTemplateId: template.id,
    },
  });
  const [owner, manager, eventAdmin, operator] = await Promise.all([
    user("owner"), user("manager"), user("eventAdmin"), user("operator"),
  ]);
  const [staffAdmin, staffSupport, staffObserver] = await Promise.all([
    user("staffAdmin", "STAFF_ADMIN"), user("staffSupport", "STAFF_SUPPORT"),
    user("staffObserver", "STAFF_OBSERVER"),
  ]);
  await prisma.orgMembership.createMany({
    data: [
      { userId: owner.id, orgId: org.id, role: "OWNER" },
      { userId: manager.id, orgId: org.id, role: "MANAGER" },
    ],
  });
  await prisma.eventMembership.createMany({
    data: [
      { userId: eventAdmin.id, eventId: event.id, role: "ADMIN" },
      { userId: operator.id, eventId: event.id, role: "OPERATOR" },
    ],
  });
  const c1 = await prisma.category.create({
    data: { eventId: event.id, name: "Participant", color: "#000000", number: 1 },
  });
  const c2 = await prisma.category.create({
    data: { eventId: event.id, name: "Exposant", color: "#111111", number: 2 },
  });
  const approved = [
    await registration(event.id, c1.id, "APPROVED", "Alpha"),
    await registration(event.id, c1.id, "APPROVED", "Bravo"),
    await registration(event.id, c2.id, "APPROVED", "Charlie"),
  ];
  const pending = await registration(event.id, c1.id, "PENDING", "Delta");
  const badgeProduct = await prisma.printProduct.create({
    data: {
      kind: "BADGE", name: "Support badge PVC", slug: uniq("badge-pvc"), category: "Badges",
      basePrice: 1500, minQuantity: 1, leadTimeDays: 5, published: true,
    },
  });
  const lanyard = await prisma.printProduct.create({
    data: {
      kind: "ACCESSORY", name: "Cordon", slug: uniq("cordon"), category: "Cordons",
      basePrice: 500, minQuantity: 1, leadTimeDays: 7, published: true,
    },
  });
  return {
    owner, manager, eventAdmin, operator, staffAdmin, staffSupport, staffObserver,
    org, event, template, categories: [c1, c2] as const, approved, pending, badgeProduct, lanyard,
  };
}

export type PrintFixture = Awaited<ReturnType<typeof seedPrintFixture>>;

// Crée une demande directement en base (sans passer par le service).
export async function makeRequest(
  fx: Pick<PrintFixture, "org" | "event" | "owner">,
  over: Partial<Prisma.PrintRequestUncheckedCreateInput> = {},
) {
  return prisma.printRequest.create({
    data: {
      reference: uniq("PR-T"),
      eventId: fx.event.id,
      orgId: fx.org.id,
      type: "ADVANCE",
      status: "SUBMITTED",
      createdById: fx.owner.id,
      ...over,
    },
  });
}
