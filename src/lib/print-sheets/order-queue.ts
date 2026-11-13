import type { Prisma, PrintRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveEventTemplate } from "@/lib/badge-templates/render-badge";
import { getOrderSheet, type OrderSheetView } from "./order-sheet";

export type OrderQueueRow = {
  requestId: string;
  reference: string;
  status: PrintRequestStatus;
  eventId: string;
  eventTitle: string;
  orgName: string;
  badgeCount: number;
  badgePages: 1 | 2;
  paidAt: string | null;
  sheet: OrderSheetView | null;
};

// File de travail : commandes à l'avance payées ou en production.
const QUEUE_STATUSES: PrintRequestStatus[] = ["PAID", "IN_PRODUCTION"];

const orderSelect = {
  id: true,
  reference: true,
  status: true,
  paidAt: true,
  badgePages: true,
  event: { select: { id: true, title: true, badgeTemplateId: true, orgId: true } },
  org: { select: { name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.PrintRequestSelect;

type OrderRecord = Prisma.PrintRequestGetPayload<{ select: typeof orderSelect }>;

async function toRow(order: OrderRecord): Promise<OrderQueueRow> {
  // Gabarit épinglé à la commande, sinon celui de l'évènement.
  const pages = order.badgePages ?? (await resolveEventTemplate(order.event)).meta.pages;
  return {
    requestId: order.id,
    reference: order.reference,
    status: order.status,
    eventId: order.event.id,
    eventTitle: order.event.title,
    orgName: order.org.name,
    badgeCount: order._count.items,
    badgePages: pages === 2 ? 2 : 1,
    paidAt: order.paidAt?.toISOString() ?? null,
    sheet: await getOrderSheet(order.id),
  };
}

const queueWhere = (generation: Prisma.PrintSheetGenerationNullableScalarRelationFilter): Prisma.PrintRequestWhereInput => ({
  type: "ADVANCE",
  status: { in: QUEUE_STATUSES },
  generation,
});

// « À traiter » : aucune planche, ou une génération pas encore terminée (en attente, en cours ou en
// échec) ; la commande ne quitte la file qu'à `DONE`, et sa ligne porte l'état de la génération.
const toGenerateWhere: Prisma.PrintRequestWhereInput = {
  type: "ADVANCE",
  status: { in: QUEUE_STATUSES },
  OR: [{ generation: { is: null } }, { generation: { is: { status: { not: "DONE" } } } }],
};

export async function listOrdersToGenerate(): Promise<OrderQueueRow[]> {
  const orders = await prisma.printRequest.findMany({
    where: toGenerateWhere,
    orderBy: [{ paidAt: "asc" }, { id: "asc" }],
    select: orderSelect,
  });
  return Promise.all(orders.map(toRow));
}

// « Générées » : une planche existe (tout état), la plus récemment générée d'abord.
export async function listOrdersWithSheet(): Promise<OrderQueueRow[]> {
  const orders = await prisma.printRequest.findMany({
    where: queueWhere({ isNot: null }),
    orderBy: [{ generation: { createdAt: "desc" } }, { id: "asc" }],
    select: orderSelect,
  });
  return Promise.all(orders.map(toRow));
}

// Compteur de l'onglet « À traiter ».
export function countOrdersToGenerate(): Promise<number> {
  return prisma.printRequest.count({ where: toGenerateWhere });
}
