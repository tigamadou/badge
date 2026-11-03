import type { OrgPrintCreditKind, Prisma, PrintQuoteLine, PrintRequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MAX_AMOUNT } from "./content";
import { PrintRequestError } from "./errors";
import { OnsiteError } from "./onsite";
import { appendThreadEvent, applyEdit, lockRequestWithEvent, recomputeTotal } from "./service";

// Crédit d'impression de l'organisation : des mouvements EARNED (> 0) et SPENT (< 0). Le solde est
// leur somme ; le « disponible » en retire les crédits déjà réservés par des devis en cours.

export const applyCreditSchema = z.object({ amount: z.number().int().min(1).max(MAX_AMOUNT) }).strict();

// Statuts dont la ligne de crédit réserve encore le solde (ensuite : dépensé, ou rendu).
const RESERVING: PrintRequestStatus[] = ["SUBMITTED", "QUOTED", "ACCEPTED"];

type Db = Prisma.TransactionClient;

async function balanceOf(db: Db, orgId: string): Promise<number> {
  const sum = await db.orgPrintCredit.aggregate({ where: { orgId }, _sum: { amount: true } });
  return sum._sum.amount ?? 0;
}

async function availableOf(db: Db, orgId: string, excludeRequestId?: string): Promise<number> {
  const reserved = await db.printQuoteLine.aggregate({
    where: {
      usesOrgCredit: true,
      removedAt: null,
      request: {
        orgId,
        status: { in: RESERVING },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
      },
    },
    _sum: { lineTotal: true },
  });
  // Les lignes de crédit sont négatives.
  return (await balanceOf(db, orgId)) + (reserved._sum.lineTotal ?? 0);
}

export const getOrgPrintCreditBalance = (orgId: string): Promise<number> => balanceOf(prisma, orgId);

export const getAvailableOrgPrintCredit = (orgId: string, excludeRequestId?: string): Promise<number> =>
  availableOf(prisma, orgId, excludeRequestId);

// `request` est null quand la demande a été supprimée (le mouvement est conservé).
export async function listOrgPrintCreditMovements(orgId: string): Promise<
  Array<{
    id: string;
    kind: OrgPrintCreditKind;
    amount: number;
    quantity: number | null;
    createdAt: Date;
    request: { id: string; reference: string; eventId: string } | null;
  }>
> {
  const rows = await prisma.orgPrintCredit.findMany({
    where: { orgId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      kind: true,
      amount: true,
      quantity: true,
      createdAt: true,
      request: { select: { id: true, reference: true, eventId: true } },
    },
  });
  return rows;
}

// Applique (ou remplace) la ligne de crédit d'une demande. Verrous : Event, PrintRequest, puis
// Organization (même ordre que markPaid, qui insère ensuite le mouvement SPENT). Aucune lecture
// simple avant le verrou de l'organisation : l'instantané de la transaction doit voir les crédits
// réservés par les applications concurrentes, déjà validées.
export async function applyOrgCredit(input: {
  requestId: string;
  amount: number;
  userId: string;
}): Promise<{ line: PrintQuoteLine; revised: boolean }> {
  const { requestId, amount, userId } = input;
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    throw new PrintRequestError("VALIDATION", 400);
  }
  return prisma.$transaction(async (tx) => {
    await lockRequestWithEvent(tx, requestId);
    const [request] = await tx.$queryRaw<Array<{ id: string; orgId: string; status: PrintRequestStatus }>>`
      SELECT id, orgId, status FROM \`PrintRequest\` WHERE id = ${requestId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM \`Organization\` WHERE id = ${request.orgId} FOR UPDATE`;

    // Avant applyEdit : ACCEPTED lèverait QUOTE_ACCEPTED, la route attend REQUEST_LOCKED.
    if (request.status !== "SUBMITTED" && request.status !== "QUOTED") {
      throw new OnsiteError("REQUEST_LOCKED", 409);
    }
    const available = await availableOf(tx, request.orgId, requestId);
    if (amount > available) throw new OnsiteError("CREDIT_INSUFFICIENT", 409, { available });

    const others = await tx.printQuoteLine.aggregate({
      where: { requestId, removedAt: null, usesOrgCredit: false },
      _sum: { lineTotal: true },
    });
    // Le total de la demande ne devient jamais négatif.
    if (amount > (others._sum.lineTotal ?? 0)) throw new OnsiteError("CREDIT_EXCEEDS_TOTAL", 409);

    const { from } = await applyEdit(tx, { id: requestId, status: request.status }, "STAFF", userId);
    await tx.printQuoteLine.updateMany({
      where: { requestId, usesOrgCredit: true, removedAt: null },
      data: { removedAt: new Date() },
    });
    const last = await tx.printQuoteLine.aggregate({ where: { requestId }, _max: { position: true } });
    const line = await tx.printQuoteLine.create({
      data: {
        requestId,
        kind: "DISCOUNT",
        label: "Crédit d'impression",
        quantity: 1,
        unitPrice: -amount,
        lineTotal: -amount,
        // Une ligne active au moins existe (le contrôle ci-dessus l'impose) : le maximum est défini.
        position: last._max.position! + 1,
        addedBy: "STAFF",
        usesOrgCredit: true,
      },
    });
    await recomputeTotal(tx, requestId);
    await appendThreadEvent(tx, requestId, "ORG_CREDIT_APPLIED", { amount }, { userId, side: "STAFF" });
    return { line, revised: from === "QUOTED" };
  });
}

// Accroche A4 : appelée dans la transaction qui vient de passer la demande à PAID (le verrou de la
// demande est tenu). Un seul mouvement SPENT par demande (@@unique [requestId, kind]) : un rejeu
// ne crée rien. Renvoie le montant dépensé, positif (0 sans ligne de crédit ou déjà dépensé).
export async function spendOrgCreditForPaidRequest(tx: Db, requestId: string): Promise<number> {
  const line = await tx.printQuoteLine.findFirst({
    where: { requestId, usesOrgCredit: true, removedAt: null },
    select: { lineTotal: true, request: { select: { orgId: true } } },
  });
  if (!line) return 0;
  const existing = await tx.orgPrintCredit.findUnique({
    where: { requestId_kind: { requestId, kind: "SPENT" } },
    select: { id: true },
  });
  if (existing) return 0;
  await tx.orgPrintCredit.create({
    data: { orgId: line.request.orgId, kind: "SPENT", amount: line.lineTotal, requestId },
  });
  await appendThreadEvent(tx, requestId, "ORG_CREDIT_SPENT", { amount: -line.lineTotal });
  return -line.lineTotal;
}
