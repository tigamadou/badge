import { Prisma } from "@prisma/client";
import type { PrintQuoteLine, PrintRequest } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { orderRegistrations } from "@/lib/print-sheets/generations";
import {
  loadProductForPricing,
  pruneChoices,
  snapshotChoices,
  unitPriceFor,
  validateChoices,
  type ChoiceResult,
  type OptionChoice,
  type ProductForPricing,
} from "@/lib/print-catalog/pricing";
import { PrintRequestError } from "./errors";
import { chunk, RESERVING_STATUSES } from "./labels";
import {
  appendThreadEvent,
  applyEdit,
  loadRequest,
  recomputeTotal,
  requestBadgeCount,
} from "./service";
import type { LineChange } from "./thread";
import type { BadgeSelection, DetailsPatch, OrganizerProductInput } from "./inputs";

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

// Traduit un échec de validateChoices en erreur de demande (partagé avec la saisie du staff).
export function choiceFailureToError(
  product: Pick<ProductForPricing, "id" | "minQuantity">,
  result: Extract<ChoiceResult, { ok: false }>,
): PrintRequestError {
  if (result.code === "PRODUCT_UNAVAILABLE") {
    return new PrintRequestError("PRODUCT_UNAVAILABLE", 400, { productId: product.id });
  }
  if (result.code === "QUANTITY_BELOW_MINIMUM") {
    return new PrintRequestError("BELOW_MIN_QUANTITY", 400, {
      productId: product.id,
      minQuantity: product.minQuantity,
    });
  }
  return new PrintRequestError("INVALID_CHOICES", 400, {
    productId: product.id,
    code: result.code,
    optionId: result.optionId,
  });
}

// Un fichier choisi doit être une pièce de cet évènement (forme stricte, comme les pièces du fil).
function isEventFileKey(key: string, eventId: string): boolean {
  const prefix = `print-requests/${eventId}/`;
  return (
    key.length <= 300 &&
    key.startsWith(prefix) &&
    /^[A-Za-z0-9._-]+$/.test(key.slice(prefix.length)) &&
    !key.includes("..")
  );
}

// Forme canonique (clés triées) pour comparer deux listes de choix, quel que soit l'ordre des clés.
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]]))
      : v,
  );
}

function priced(product: ProductForPricing, choices: OptionChoice[], quantity: number): number {
  const result = validateChoices(product, choices, quantity);
  if (!result.ok) throw choiceFailureToError(product, result);
  return unitPriceFor(product, quantity, choices);
}

function lineData(
  product: ProductForPricing,
  choices: OptionChoice[],
  quantity: number,
  unitPrice: number,
  position: number,
) {
  return {
    label: product.name,
    optionsSnapshot: snapshotChoices(product, choices, quantity) as unknown as Prisma.InputJsonValue,
    choices: choices as unknown as Prisma.InputJsonValue,
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    position,
  };
}

// Remplace les produits choisis par l'organisateur : un support BADGE (quantité = nombre de
// badges) et des accessoires. Les lignes du staff ne sont pas touchées.
export async function setOrganizerProducts(input: {
  requestId: string;
  eventId: string;
  userId: string;
  products: OrganizerProductInput[];
}): Promise<{ lines: PrintQuoteLine[]; total: number; revised: boolean }> {
  const request = await loadRequest(input.requestId, { eventId: input.eventId });
  const { products } = input;

  const ids = products.map((p) => p.productId);
  if (new Set(ids).size !== ids.length) throw new PrintRequestError("VALIDATION", 400);
  for (const entry of products) {
    for (const choice of entry.choices) {
      if (choice.fileKey !== undefined && !isEventFileKey(choice.fileKey, input.eventId)) {
        throw new PrintRequestError("INVALID_CHOICES", 400, {
          productId: entry.productId,
          code: "INVALID_FILE",
          optionId: choice.optionId,
        });
      }
    }
  }

  const loaded = await Promise.all(ids.map((id) => loadProductForPricing(id)));
  const resolved = loaded.map((product, index) => {
    if (!product) throw new PrintRequestError("PRODUCT_UNAVAILABLE", 400, { productId: ids[index] });
    return { product, entry: products[index] };
  });
  const badges = resolved.filter((r) => r.product.kind === "BADGE");
  if (badges.length !== 1) throw new PrintRequestError("BADGE_PRODUCT_REQUIRED", 400);
  const ordered = [...badges, ...resolved.filter((r) => r.product.kind !== "BADGE")];

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM \`PrintRequest\` WHERE id = ${request.id} FOR UPDATE`;
    const current = await tx.printRequest.findUniqueOrThrow({ where: { id: request.id } });
    const { from } = await applyEdit(tx, current, "ORGANIZER", input.userId);

    const badgeCount = await requestBadgeCount(tx, current);
    if (badgeCount === 0) throw new PrintRequestError("BADGE_COUNT_REQUIRED", 409);

    const existing = await tx.printQuoteLine.findMany({
      where: { requestId: request.id, kind: "PRODUCT", addedBy: "ORGANIZER", removedAt: null },
      orderBy: { position: "asc" },
    });
    const byProduct = new Map(existing.map((line) => [line.productId, line]));
    const changes: LineChange[] = [];
    const keptIds = new Set<string>();

    for (const [position, { product, entry }] of ordered.entries()) {
      const derivedQuantity = product.kind === "BADGE" || entry.quantity === null;
      const line = byProduct.get(product.id);
      const quantity = product.kind === "BADGE" ? badgeCount : (entry.quantity ?? badgeCount);
      let choices = entry.choices;

      if (line) {
        keptIds.add(line.id);
        const sameChoices = canonical(line.choices ?? []) === canonical(choices);
        // Quantité non saisie sur une ligne fixée par le staff : l'organisateur ne la conteste pas.
        const effectiveQuantity = derivedQuantity && line.quantityOverridden ? line.quantity : quantity;
        if (sameChoices && effectiveQuantity === line.quantity) {
          if (line.position !== position) {
            await tx.printQuoteLine.update({ where: { id: line.id }, data: { position } });
          }
          continue;
        }
        if (line.priceOverridden || line.quantityOverridden) {
          throw new PrintRequestError("LINE_LOCKED_BY_STAFF", 409, { productId: product.id });
        }
        // Mêmes choix : on rouvre la configuration enregistrée, sans ce qui a disparu du catalogue.
        if (sameChoices) choices = pruneChoices(product, choices);
        const unitPrice = priced(product, choices, effectiveQuantity);
        await tx.printQuoteLine.update({
          where: { id: line.id },
          data: lineData(product, choices, effectiveQuantity, unitPrice, position),
        });
        changes.push({
          op: "UPDATED",
          lineId: line.id,
          label: product.name,
          from: { quantity: line.quantity, unitPrice: line.unitPrice },
          to: { quantity: effectiveQuantity, unitPrice },
        });
        continue;
      }

      const unitPrice = priced(product, choices, quantity);
      const created = await tx.printQuoteLine.create({
        data: {
          requestId: request.id,
          kind: "PRODUCT",
          productId: product.id,
          addedBy: "ORGANIZER",
          ...lineData(product, choices, quantity, unitPrice, position),
        },
      });
      changes.push({
        op: "ADDED",
        lineId: created.id,
        label: product.name,
        to: { quantity, unitPrice },
      });
    }

    for (const line of existing.filter((l) => !keptIds.has(l.id))) {
      if (current.status === "DRAFT") {
        await tx.printQuoteLine.delete({ where: { id: line.id } });
      } else {
        await tx.printQuoteLine.update({ where: { id: line.id }, data: { removedAt: new Date() } });
        changes.push({
          op: "REMOVED",
          lineId: line.id,
          label: line.label,
          from: { quantity: line.quantity, unitPrice: line.unitPrice },
        });
      }
    }

    if (current.status !== "DRAFT" && changes.length > 0) {
      await appendThreadEvent(
        tx,
        request.id,
        "LINES_CHANGED",
        { changes },
        { userId: input.userId, side: "ORGANIZER" },
      );
    }
    const total = await recomputeTotal(tx, request.id);
    const lines = await tx.printQuoteLine.findMany({
      where: { requestId: request.id, removedAt: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    return { lines, total, revised: from === "QUOTED" };
  });
}
