import type { PrintRequest, PrintRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { orderRegistrations } from "@/lib/print-sheets/generations";
import {
  notifyPrintRequestPaid,
  notifyPrintRequestStatusChanged,
  notifyPrintRequestSubmitted,
} from "@/lib/notifications/triggers";
import { lockEventRow, reservedRegistrations } from "./content";
import { PrintRequestError } from "./errors";
import { chunk } from "./labels";
import { prepareOnsiteSubmission } from "./onsite";
import { spendOrgCreditForPaidRequest } from "./org-credit";
import {
  appendThreadEvent,
  applyTransition,
  assertOrganizerMayChange,
  assertOwner,
  loadRequest,
  lockRequestWithEvent,
  markPaid,
  requestBadgeCount,
  snapshotEventTemplate,
} from "./service";

const ID_CHUNK = 5000;

const filled = (value: string | null): boolean => (value ?? "").trim() !== "";

// Champs manquants pour une commande en amont (hors sélection de badges).
function missingAdvanceFields(r: PrintRequest): string[] {
  if (!r.delivery) return ["delivery"];
  if (r.delivery !== "DELIVERY") return [];
  const missing: string[] = [];
  if (!filled(r.deliveryAddress)) missing.push("deliveryAddress");
  if (!filled(r.deliveryContactName)) missing.push("deliveryContactName");
  if (!filled(r.deliveryContactPhone)) missing.push("deliveryContactPhone");
  return missing;
}

function missingOnsiteFields(r: PrintRequest): string[] {
  const missing: string[] = [];
  if (!r.estimatedQuantity || r.estimatedQuantity <= 0) missing.push("estimatedQuantity");
  if (!Array.isArray(r.onsiteSchedule) || r.onsiteSchedule.length === 0) missing.push("onsiteSchedule");
  if (!filled(r.onsiteLocation)) missing.push("onsiteLocation");
  if (!filled(r.onsiteContactName)) missing.push("onsiteContactName");
  if (!filled(r.onsiteContactPhone)) missing.push("onsiteContactPhone");
  return missing;
}

// Envoie un brouillon au staff. Ordre des verrous : la ligne Event d'abord (réservations
// sérialisées par évènement), puis la ligne PrintRequest (appendThreadEvent).
export async function submitRequest(input: {
  requestId: string;
  eventId: string;
  userId: string;
  now?: Date;
}): Promise<PrintRequest> {
  await loadRequest(input.requestId, { eventId: input.eventId });
  const result = await prisma.$transaction(async (tx) => {
    await lockEventRow(tx, input.eventId);
    // Verrou de la commande avant toute lecture : une modification ou annulation concurrente
    // s'enchaîne au lieu d'être validée à tort ou perdue.
    await lockRequestWithEvent(tx, input.requestId);
    const request = await tx.printRequest.findUniqueOrThrow({ where: { id: input.requestId } });
    if (request.status !== "DRAFT") {
      throw new PrintRequestError("INVALID_TRANSITION", 409, { from: request.status, action: "SUBMIT" });
    }

    const badgeLines = await tx.printQuoteLine.count({
      where: { requestId: request.id, removedAt: null, kind: "PRODUCT", product: { kind: "BADGE" } },
    });
    if (badgeLines !== 1) throw new PrintRequestError("BADGE_PRODUCT_REQUIRED", 400);

    let itemRows: { registrationId: string; registration: Parameters<typeof orderRegistrations>[0][number] }[] = [];
    if (request.type === "ADVANCE") {
      const items = await tx.printRequestItem.findMany({
        where: { requestId: request.id },
        select: {
          registrationId: true,
          registration: {
            select: {
              id: true,
              snapshotLastName: true,
              snapshotFirstName: true,
              category: { select: { number: true } },
            },
          },
        },
      });
      if (items.length === 0) throw new PrintRequestError("EMPTY_SELECTION", 400);
      const fields = missingAdvanceFields(request);
      if (fields.length > 0) throw new PrintRequestError("DELIVERY_INCOMPLETE", 400, { fields });
      itemRows = items;

      const reserved = await reservedRegistrations(tx, input.eventId, request.id);
      const taken = items.map((i) => i.registrationId).filter((id) => reserved.has(id));
      if (taken.length > 0) throw new PrintRequestError("REGISTRATIONS_TAKEN", 409, { registrationIds: taken });
    } else {
      const fields = missingOnsiteFields(request);
      if (fields.length > 0) throw new PrintRequestError("ONSITE_INCOMPLETE", 400, { fields });
    }

    // Positions recalculées dans l'ordre d'impression (catégorie, nom, prénom).
    if (itemRows.length > 0) {
      const ordered = orderRegistrations(itemRows.map((i) => i.registration));
      await tx.printRequestItem.deleteMany({ where: { requestId: request.id } });
      const data = ordered.map((row, position) => ({
        requestId: request.id,
        registrationId: row.id,
        position,
      }));
      for (const part of chunk(data, ID_CHUNK)) await tx.printRequestItem.createMany({ data: part });
    }

    const snapshot = await snapshotEventTemplate(input.eventId, tx);
    // Commande sur place : template adapté exigé, marge par défaut figée dans la commande.
    const onsite = await prepareOnsiteSubmission(tx, { type: request.type, badgeTemplateId: snapshot.badgeTemplateId });
    await tx.printRequest.update({
      where: { id: request.id },
      data: {
        ...(onsite ? { marginPercent: onsite.marginPercent } : {}),
        badgeTemplateId: snapshot.badgeTemplateId,
        badgeWidthPx: snapshot.badgeWidthPx,
        badgeHeightPx: snapshot.badgeHeightPx,
        badgePages: snapshot.badgePages,
      },
    });
    await applyTransition(tx, request, "SUBMIT", "ORGANIZER", input.now);
    const badgeCount = await requestBadgeCount(tx, request);
    await appendThreadEvent(
      tx,
      request.id,
      "SUBMITTED",
      { badgeCount, total: request.total },
      { userId: input.userId, side: "ORGANIZER" },
    );
    return tx.printRequest.findUniqueOrThrow({ where: { id: request.id } });
  });

  await notifyPrintRequestSubmitted(result.id, input.userId);
  return result;
}

// Annule une commande (tout statut jusqu'à ACCEPTED). Les items restent en base : la réservation
// tombe avec le statut. La ligne de la commande est verrouillée avant la sonde de paiement.
export async function cancelRequest(input: {
  requestId: string;
  eventId: string;
  userId: string;
}): Promise<{ request: PrintRequest; from: PrintRequestStatus }> {
  await loadRequest(input.requestId, { eventId: input.eventId });
  const { request, from } = await prisma.$transaction(async (tx) => {
    await lockRequestWithEvent(tx, input.requestId);
    const current = await tx.printRequest.findUniqueOrThrow({ where: { id: input.requestId } });
    assertOrganizerMayChange(current, "ORGANIZER");
    await applyTransition(tx, current, "CANCEL", "ORGANIZER");
    // Un brouillon n'a jamais été vu du staff : ni entrée du fil ni notification.
    if (current.status !== "DRAFT") {
      await appendThreadEvent(tx, current.id, "CANCELLED", {}, { userId: input.userId, side: "ORGANIZER" });
    }
    return {
      request: await tx.printRequest.findUniqueOrThrow({ where: { id: current.id } }),
      from: current.status,
    };
  });
  if (from !== "DRAFT") {
    await notifyPrintRequestStatusChanged(request.id, input.userId, { organizer: false, staff: true });
  }
  return { request, from };
}

// Accepte le devis courant. Réservé au propriétaire de l'organisation.
export async function acceptQuote(input: {
  requestId: string;
  eventId: string;
  userId: string;
  version: number;
  now?: Date;
}): Promise<PrintRequest> {
  const loaded = await loadRequest(input.requestId, { eventId: input.eventId });
  await assertOwner(input.userId, loaded.orgId);
  const now = input.now ?? new Date();
  const result = await prisma.$transaction(async (tx) => {
    await lockRequestWithEvent(tx, input.requestId);
    const request = await tx.printRequest.findUniqueOrThrow({ where: { id: input.requestId } });
    if (request.status !== "QUOTED") {
      throw new PrintRequestError("INVALID_TRANSITION", 409, { from: request.status, action: "ACCEPT" });
    }
    if (input.version !== request.quoteVersion) {
      throw new PrintRequestError("QUOTE_VERSION_MISMATCH", 409, { current: request.quoteVersion });
    }
    await applyTransition(tx, request, "ACCEPT", "ORGANIZER");
    await tx.printRequest.update({
      where: { id: request.id },
      data: {
        acceptedVersion: request.quoteVersion,
        acceptedTotal: request.total,
        acceptedAt: now,
        acceptedById: input.userId,
      },
    });
    await appendThreadEvent(
      tx,
      request.id,
      "QUOTE_ACCEPTED",
      { version: request.quoteVersion, total: request.total },
      { userId: input.userId, side: "ORGANIZER" },
    );
    // Devis entièrement couvert par le crédit d'impression : rien à payer, la commande passe PAID dans
    // la même transaction (mouvement SPENT compris). Aucun Payment n'est créé.
    const paid = request.total === 0;
    if (paid) {
      // markPaid ne renvoie jamais faux ici : la commande vient de passer ACCEPTED sous le verrou.
      await markPaid(tx, request.id, { byCredit: true });
      await spendOrgCreditForPaidRequest(tx, request.id);
    }
    return { request: await tx.printRequest.findUniqueOrThrow({ where: { id: request.id } }), paid };
  });
  const { request: accepted, paid } = result;
  if (paid) await notifyPrintRequestPaid(accepted.id, input.userId);
  else await notifyPrintRequestStatusChanged(accepted.id, input.userId, { organizer: false, staff: true });
  return accepted;
}
