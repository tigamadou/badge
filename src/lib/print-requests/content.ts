import { Prisma } from "@prisma/client";
import type { PrintRequest } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { orderRegistrations } from "@/lib/print-sheets/generations";
import { PrintRequestError } from "./errors";
import { chunk, RESERVING_STATUSES } from "./labels";
import { appendThreadEvent, applyEdit, loadRequest, recomputeTotal } from "./service";
import type { BadgeSelection, DetailsPatch } from "./inputs";

// Taille des paquets pour les lectures et écritures par identifiants (borne les paramètres SQL).
const ID_CHUNK = 5000;

// Sérialise les réservations d'un évènement : deux demandes ne se réservent pas la même
// inscription en parallèle. À appeler avant de lire les réservations existantes.
export async function lockEventRow(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM \`Event\` WHERE id = ${eventId} FOR UPDATE`;
}

// Inscription -> référence de la demande qui la réserve (hors la demande exclue).
export async function reservedRegistrations(
  tx: Prisma.TransactionClient,
  eventId: string,
  excludeRequestId: string,
): Promise<Map<string, string>> {
  const items = await tx.printRequestItem.findMany({
    where: {
      request: { eventId, status: { in: RESERVING_STATUSES }, id: { not: excludeRequestId } },
    },
    select: { registrationId: true, request: { select: { reference: true } } },
  });
  return new Map(items.map((item) => [item.registrationId, item.request.reference]));
}

export type CandidateRow = {
  id: string;
  firstName: string;
  lastName: string;
  categoryId: string;
  categoryName: string;
  categoryNumber: number;
  printed: boolean;
  reservedBy: string | null;
  selected: boolean;
};

// Inscriptions approuvées de l'évènement, dans l'ordre d'impression, avec leur état de réservation.
export async function listCandidates(eventId: string, requestId: string): Promise<CandidateRow[]> {
  const [rows, reserved, selectedItems] = await Promise.all([
    prisma.registration.findMany({
      where: { eventId, status: "APPROVED" },
      select: {
        id: true,
        snapshotFirstName: true,
        snapshotLastName: true,
        badgePrinted: true,
        category: { select: { id: true, name: true, number: true } },
      },
    }),
    reservedRegistrations(prisma, eventId, requestId),
    prisma.printRequestItem.findMany({ where: { requestId }, select: { registrationId: true } }),
  ]);
  const selected = new Set(selectedItems.map((item) => item.registrationId));
  return orderRegistrations(rows).map((row) => ({
    id: row.id,
    firstName: row.snapshotFirstName,
    lastName: row.snapshotLastName,
    categoryId: row.category.id,
    categoryName: row.category.name,
    categoryNumber: row.category.number,
    printed: row.badgePrinted,
    reservedBy: reserved.get(row.id) ?? null,
    selected: selected.has(row.id),
  }));
}

// Une ligne à répartition de quantité (QUANTITY_SPLIT) ne suit pas le nombre de badges : sa
// quantité est la somme de la répartition choisie, comme une quantité fixée à la main.
function hasQuantitySplit(choices: Prisma.JsonValue | null): boolean {
  if (!Array.isArray(choices)) return false;
  return choices.some((choice) => {
    const split = (choice as { split?: unknown } | null)?.split;
    return Array.isArray(split) && split.length > 0;
  });
}

// Aligne les quantités des lignes produit sur le nouveau nombre de badges. Le prix unitaire reste
// figé (aucun recalcul de palier ni de minQuantity : le staff fixe le prix). Les lignes dont la
// quantité est fixée (à la main ou par répartition) ne bougent pas ; celles qui diffèrent du
// nouveau nombre sont signalées dans `lagging`.
export async function followBadgeCount(
  tx: Prisma.TransactionClient,
  requestId: string,
  previous: number,
  next: number,
): Promise<{ lagging: string[] }> {
  const lines = await tx.printQuoteLine.findMany({
    where: { requestId, kind: "PRODUCT", removedAt: null },
    orderBy: { position: "asc" },
  });
  const lagging: string[] = [];
  for (const line of lines) {
    const fixed = line.quantityOverridden || hasQuantitySplit(line.choices);
    if (fixed) {
      if (line.quantity !== next) lagging.push(line.label);
    } else if (line.quantity === previous) {
      await tx.printQuoteLine.update({
        where: { id: line.id },
        data: { quantity: next, lineTotal: next * line.unitPrice },
      });
    }
  }
  await recomputeTotal(tx, requestId);
  return { lagging };
}

async function resolveSelection(
  tx: Prisma.TransactionClient,
  request: Pick<PrintRequest, "id">,
  eventId: string,
  selection: BadgeSelection,
) {
  const select = {
    id: true,
    snapshotLastName: true,
    snapshotFirstName: true,
    category: { select: { number: true } },
  } as const;
  const reserved = await reservedRegistrations(tx, eventId, request.id);

  if (selection.mode === "IDS") {
    const ids = [...new Set(selection.registrationIds)];
    const rows = (
      await Promise.all(
        chunk(ids, ID_CHUNK).map((part) =>
          tx.registration.findMany({
            where: { id: { in: part }, eventId, status: "APPROVED" },
            select,
          }),
        ),
      )
    ).flat();
    const found = new Set(rows.map((row) => row.id));
    const unknown = ids.filter((id) => !found.has(id));
    if (unknown.length > 0) {
      throw new PrintRequestError("INVALID_SELECTION", 400, { registrationIds: unknown });
    }
    const taken = ids.filter((id) => reserved.has(id));
    if (taken.length > 0) {
      throw new PrintRequestError("REGISTRATIONS_TAKEN", 409, { registrationIds: taken });
    }
    return rows;
  }

  const rows = await tx.registration.findMany({
    where: {
      eventId,
      status: "APPROVED",
      badgePrinted: false,
      ...(selection.mode === "CATEGORIES" ? { categoryId: { in: selection.categoryIds } } : {}),
    },
    select,
  });
  const available = rows.filter((row) => !reserved.has(row.id));
  if (available.length === 0) throw new PrintRequestError("EMPTY_SELECTION", 400);
  return available;
}

// Remplace les badges d'une demande en amont. Les réservations sont sérialisées par évènement
// (verrou sur la ligne Event) dès que la demande n'est plus un brouillon.
export async function setBadges(input: {
  requestId: string;
  eventId: string;
  userId: string;
  selection: BadgeSelection;
}): Promise<{ count: number; revised: boolean }> {
  const request = await loadRequest(input.requestId, { eventId: input.eventId });
  if (request.type !== "ADVANCE") throw new PrintRequestError("TYPE_MISMATCH", 400);

  return prisma.$transaction(async (tx) => {
    if (request.status !== "DRAFT") await lockEventRow(tx, input.eventId);
    const { from } = await applyEdit(tx, request, "ORGANIZER", input.userId);

    const rows = orderRegistrations(await resolveSelection(tx, request, input.eventId, input.selection));
    const previousItems = await tx.printRequestItem.findMany({
      where: { requestId: request.id },
      select: { registrationId: true },
    });
    const previousIds = new Set(previousItems.map((item) => item.registrationId));
    const nextIds = new Set(rows.map((row) => row.id));
    const added = rows.filter((row) => !previousIds.has(row.id)).length;
    const removed = [...previousIds].filter((id) => !nextIds.has(id)).length;

    await tx.printRequestItem.deleteMany({ where: { requestId: request.id } });
    for (const part of chunk(rows.map((row, position) => ({ requestId: request.id, registrationId: row.id, position })), ID_CHUNK)) {
      await tx.printRequestItem.createMany({ data: part });
    }

    const { lagging } = await followBadgeCount(tx, request.id, previousIds.size, rows.length);
    if (request.status !== "DRAFT") {
      await appendThreadEvent(
        tx,
        request.id,
        "BADGES_CHANGED",
        { added, removed, count: rows.length, lagging },
        { userId: input.userId, side: "ORGANIZER" },
      );
    }
    return { count: rows.length, revised: from === "QUOTED" };
  });
}

// Libellés (fil) des champs modifiables ; les deux contacts partagent leurs libellés.
const FIELD_LABELS: [keyof DetailsPatch, string][] = [
  ["delivery", "mode de remise"],
  ["deliveryAddress", "adresse de livraison"],
  ["deliveryContactName", "contact"],
  ["deliveryContactPhone", "téléphone du contact"],
  ["wantedBy", "date souhaitée"],
  ["estimatedQuantity", "quantité estimée"],
  ["onsiteSchedule", "horaires sur place"],
  ["onsiteLocation", "lieu"],
  ["onsiteContactName", "contact"],
  ["onsiteContactPhone", "téléphone du contact"],
  ["notes", "remarque"],
];

const ADVANCE_ONLY: (keyof DetailsPatch)[] = [
  "delivery", "deliveryAddress", "deliveryContactName", "deliveryContactPhone", "wantedBy",
];
const ONSITE_ONLY: (keyof DetailsPatch)[] = [
  "estimatedQuantity", "onsiteSchedule", "onsiteLocation", "onsiteContactName", "onsiteContactPhone",
];

export async function updateDetails(input: {
  requestId: string;
  eventId: string;
  userId: string;
  patch: DetailsPatch;
}): Promise<{ request: PrintRequest; revised: boolean }> {
  const request = await loadRequest(input.requestId, { eventId: input.eventId });
  const { patch } = input;
  const forbidden = request.type === "ADVANCE" ? ONSITE_ONLY : ADVANCE_ONLY;
  if (forbidden.some((key) => patch[key] !== undefined)) {
    throw new PrintRequestError("TYPE_MISMATCH", 400);
  }

  return prisma.$transaction(async (tx) => {
    const { from } = await applyEdit(tx, request, "ORGANIZER", input.userId);

    const data: Prisma.PrintRequestUncheckedUpdateInput = {};
    for (const [key] of FIELD_LABELS) {
      const value = patch[key];
      if (value === undefined) continue;
      (data as Record<string, unknown>)[key] =
        key === "wantedBy" && value !== null ? new Date(value as string) : value;
    }
    const updated = await tx.printRequest.update({ where: { id: request.id }, data });

    if (patch.estimatedQuantity !== undefined && patch.estimatedQuantity !== request.estimatedQuantity) {
      await followBadgeCount(tx, request.id, request.estimatedQuantity ?? 0, patch.estimatedQuantity);
    }

    const fields = [...new Set(FIELD_LABELS.filter(([key]) => patch[key] !== undefined).map(([, label]) => label))];
    if (request.status !== "DRAFT" && fields.length > 0) {
      await appendThreadEvent(tx, request.id, "REQUEST_UPDATED", { fields }, { userId: input.userId, side: "ORGANIZER" });
    }
    const fresh = await tx.printRequest.findUniqueOrThrow({ where: { id: updated.id } });
    return { request: fresh, revised: from === "QUOTED" };
  });
}
