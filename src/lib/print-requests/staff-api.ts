import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { PrintQuoteLine, PrintRequest } from "@prisma/client";
import type { z } from "zod";
import { PrintRequestError } from "./errors";
import { OnsiteError, onsiteOrPrintErrorResponse } from "./onsite";
import { prisma } from "@/lib/prisma";
import { loadRequest } from "./service";

// Corps JSON validé par un schéma zod ; tout écart devient une erreur VALIDATION (400).
export async function parseBody<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new PrintRequestError("VALIDATION", 400);
  return parsed.data;
}

// Un brouillon est invisible du staff : il répond comme une demande inexistante.
export async function loadStaffRequest(requestId: string): Promise<PrintRequest> {
  const request = await loadRequest(requestId);
  if (request.status === "DRAFT") throw new PrintRequestError("NOT_FOUND", 404);
  return request;
}

// Exécute le corps d'une route et traduit les PrintRequestError en réponse JSON.
export async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof PrintRequestError || err instanceof OnsiteError) return onsiteOrPrintErrorResponse(err);
    throw err;
  }
}

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

// Champs exposés d'une demande : ni l'auteur, ni le paiement interne, ni le chaînage du plan 35.
export function requestDTO(r: PrintRequest) {
  return {
    id: r.id,
    reference: r.reference,
    eventId: r.eventId,
    orgId: r.orgId,
    type: r.type,
    status: r.status,
    delivery: r.delivery,
    deliveryAddress: r.deliveryAddress,
    deliveryContactName: r.deliveryContactName,
    deliveryContactPhone: r.deliveryContactPhone,
    wantedBy: r.wantedBy,
    estimatedQuantity: r.estimatedQuantity,
    onsiteSchedule: r.onsiteSchedule,
    onsiteLocation: r.onsiteLocation,
    onsiteContactName: r.onsiteContactName,
    onsiteContactPhone: r.onsiteContactPhone,
    notes: r.notes,
    quoteVersion: r.quoteVersion,
    acceptedVersion: r.acceptedVersion,
    acceptedTotal: r.acceptedTotal,
    acceptedAt: r.acceptedAt,
    total: r.total,
    submittedAt: r.submittedAt,
    quotedAt: r.quotedAt,
    paidAt: r.paidAt,
    completedAt: r.completedAt,
    cancelledAt: r.cancelledAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function lineDTO(l: PrintQuoteLine) {
  return {
    id: l.id,
    kind: l.kind,
    productId: l.productId,
    label: l.label,
    optionsSnapshot: l.optionsSnapshot,
    choices: l.choices,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    lineTotal: l.lineTotal,
    position: l.position,
    addedBy: l.addedBy,
    priceOverridden: l.priceOverridden,
    quantityOverridden: l.quantityOverridden,
  };
}

// Demandes en attente de traitement : pastille du menu staff.
export function getSubmittedPrintRequestCount(): Promise<number> {
  return prisma.printRequest.count({ where: { status: "SUBMITTED" } });
}
