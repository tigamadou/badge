import type { Prisma, PrintRequestType } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  findEffectiveTemplateRow,
  resolveEventTemplateId,
} from "@/lib/badge-templates/event-template-variables";
import { prisma } from "@/lib/prisma";
import { getOnsitePrintSettings } from "@/lib/settings";
import { PrintRequestError, printRequestErrorResponse } from "./errors";

export type OnsiteErrorCode =
  | "ONSITE_TEMPLATE_UNSUITABLE"
  | "NOT_FOUND"
  | "NOT_ONSITE"
  | "REQUEST_NOT_PRINTABLE"
  | "REGISTRATION_NOT_FOUND"
  | "FOREIGN_EVENT"
  | "NOT_APPROVED"
  | "ALREADY_PRINTED"
  | "CAP_REACHED"
  | "MARGIN_BELOW_PRINTED"
  | "NOT_CLOSABLE"
  | "REQUEST_LOCKED"
  | "CREDIT_INSUFFICIENT"
  | "CREDIT_EXCEEDS_TOTAL";

// Messages en français affichés par toastApiError (qui lit `message`).
export const ONSITE_ERROR_MESSAGES: Record<OnsiteErrorCode, string> = {
  ONSITE_TEMPLATE_UNSUITABLE: "Le modèle de badge de cet évènement n'est pas adapté à l'impression sur place.",
  NOT_FOUND: "Demande introuvable.",
  NOT_ONSITE: "Cette demande n'est pas une demande d'impression sur place.",
  REQUEST_NOT_PRINTABLE: "Cette demande n'est pas ouverte à l'impression.",
  REGISTRATION_NOT_FOUND: "Inscription introuvable.",
  FOREIGN_EVENT: "Ce QR ne correspond pas à cet évènement.",
  NOT_APPROVED: "Cette inscription n'est pas approuvée.",
  ALREADY_PRINTED: "Le badge de cette inscription a déjà été imprimé.",
  CAP_REACHED: "Le plafond d'impression de cette demande est atteint.",
  MARGIN_BELOW_PRINTED: "La marge ne peut pas être inférieure au nombre de badges déjà imprimés.",
  NOT_CLOSABLE: "Cette demande ne peut pas être clôturée.",
  REQUEST_LOCKED: "Cette demande ne peut plus être modifiée.",
  CREDIT_INSUFFICIENT: "Le crédit disponible est insuffisant.",
  CREDIT_EXCEEDS_TOTAL: "Le crédit ne peut pas dépasser le total de la demande.",
};

export class OnsiteError extends Error {
  constructor(
    readonly code: OnsiteErrorCode,
    readonly httpStatus: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "OnsiteError";
  }
}

// `details` est envoyé au client par conception : n'y mettre aucune donnée interne.
export function onsiteErrorResponse(err: OnsiteError): NextResponse {
  return NextResponse.json(
    { ...err.details, error: err.code, code: err.code, message: ONSITE_ERROR_MESSAGES[err.code] },
    { status: err.httpStatus },
  );
}

// Les routes d'impression lèvent deux familles d'erreurs : on les traduit toutes les deux.
export function onsiteOrPrintErrorResponse(err: unknown): NextResponse {
  if (err instanceof OnsiteError) return onsiteErrorResponse(err);
  return printRequestErrorResponse(err);
}

// Éligibilité : le template effectif de l'évènement (celui que copie la demande à l'envoi,
// repli compris) figure dans la liste des templates adaptés à l'impression sur place.
export async function getOnsiteEligibility(eventId: string): Promise<{ eligible: boolean; templateId: string | null }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { badgeTemplateId: true, orgId: true },
  });
  if (!event) throw new PrintRequestError("NOT_FOUND", 404);
  const [row, settings] = await Promise.all([
    findEffectiveTemplateRow(await resolveEventTemplateId(event)),
    getOnsitePrintSettings(),
  ]);
  // Aucun template lisible : non éligible, sans erreur (l'assistant désactive l'option).
  if (!row) return { eligible: false, templateId: null };
  return { eligible: settings.templateIds.includes(row.id), templateId: row.id };
}

// Accroche de l'envoi, sur la copie du template prise par l'envoi : `null` pour une demande en
// amont ; sinon refuse un template inadapté et rend la marge par défaut du moment (figée dans la demande).
export async function prepareOnsiteSubmission(
  _tx: Prisma.TransactionClient,
  request: { type: PrintRequestType; badgeTemplateId: string },
): Promise<{ marginPercent: number } | null> {
  if (request.type !== "ONSITE") return null;
  const settings = await getOnsitePrintSettings();
  if (!settings.templateIds.includes(request.badgeTemplateId)) {
    throw new OnsiteError("ONSITE_TEMPLATE_UNSUITABLE", 409);
  }
  return { marginPercent: settings.defaultMarginPercent };
}

export type OnsiteTemplateStatus = "OK" | "UNSUITABLE" | "NOT_APPLICABLE";
type StatusInput = { type: PrintRequestType; parentRequestId: string | null; badgeTemplateId: string | null };

// Lit la copie du template de la demande (tenue à jour par syncRequestTemplates). Les demandes
// en amont, les demandes complémentaires et les brouillons (pas de copie) ne sont pas concernés.
export async function onsiteTemplateStatus(request: StatusInput): Promise<OnsiteTemplateStatus> {
  if (request.type !== "ONSITE" || request.parentRequestId !== null || request.badgeTemplateId === null) {
    return "NOT_APPLICABLE";
  }
  const settings = await getOnsitePrintSettings();
  return settings.templateIds.includes(request.badgeTemplateId) ? "OK" : "UNSUITABLE";
}

export async function assertOnsiteCanAdvance(request: StatusInput): Promise<void> {
  if ((await onsiteTemplateStatus(request)) === "UNSUITABLE") {
    throw new OnsiteError("ONSITE_TEMPLATE_UNSUITABLE", 409);
  }
}
