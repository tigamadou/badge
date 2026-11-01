import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MAX_AMOUNT } from "./content";
import { OnsiteError } from "./onsite";
import { computeOnsiteCounter, findOrderedBadgeLine } from "./onsite-counter";
import { lockRequestWithEvent, nextReference, retryOnReferenceCollision } from "./service";
import { appendThreadEvent } from "./thread";

// Clôture d'une demande sur place : les badges commandés mais non imprimés deviennent un crédit
// d'impression, les badges imprimés en trop une demande complémentaire. Les deux s'excluent.

export type OnsiteClosure =
  | { outcome: "CREDIT"; amount: number; unusedBadges: number }
  | { outcome: "SUPPLEMENT"; supplementRequestId: string; extraBadges: number; total: number }
  | { outcome: "NONE" };

// Prix unitaire effectif : unitPrice x min(1, (total accepté + crédit dépensé) / somme des lignes
// positives), arrondi à l'entier. Une remise du staff ou un crédit appliqué ne doit pas être
// recrédité comme si les badges avaient été payés plein tarif. Calcul entier (BigInt) : les montants
// peuvent atteindre 2 milliards. Sans total accepté, le prix de la ligne reste inchangé.
export function effectiveUnitPrice(
  unitPrice: number,
  acceptedTotal: number | null,
  creditSpent: number,
  positiveSum: number,
): number {
  if (!acceptedTotal || positiveSum <= 0) return unitPrice;
  const paid = acceptedTotal + creditSpent;
  if (paid >= positiveSum) return unitPrice;
  const two = BigInt(2);
  const total = BigInt(positiveSum);
  return Number((two * BigInt(unitPrice) * BigInt(paid) + total) / (two * total));
}

const SUPPLEMENT_LABEL = "Badges supplémentaires";

// Un JSON absent en base s'écrit Prisma.JsonNull, pas null.
const jsonOrNull = (v: Prisma.JsonValue | null): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue);

// Corps de la clôture. Les verrous Event puis PrintRequest sont déjà tenus par l'appelant (ordre du
// chantier). Idempotente : un résultat déjà produit est relu, jamais recréé (le crédit est protégé
// en plus par la contrainte unique [requestId, kind]).
export async function closeOnsiteInTx(
  tx: Prisma.TransactionClient,
  requestId: string,
  userId?: string,
): Promise<OnsiteClosure> {
  // La demande est verrouillée par l'appelant : elle existe.
  const request = await tx.printRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.type !== "ONSITE" || request.parentRequestId !== null || request.status !== "COMPLETED") {
    throw new OnsiteError("NOT_CLOSABLE", 409);
  }

  const earned = await tx.orgPrintCredit.findUnique({
    where: { requestId_kind: { requestId, kind: "EARNED" } },
  });
  if (earned) return { outcome: "CREDIT", amount: earned.amount, unusedBadges: earned.quantity! };
  const supplement = await tx.printRequest.findFirst({
    where: { parentRequestId: requestId, type: "ONSITE" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (supplement) {
    return {
      outcome: "SUPPLEMENT",
      supplementRequestId: supplement.id,
      extraBadges: supplement.estimatedQuantity!,
      total: supplement.total,
    };
  }

  const lines = await tx.printQuoteLine.findMany({
    where: { requestId, removedAt: null },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    include: { product: { select: { kind: true } } },
  });
  // Règle : seule la PREMIÈRE ligne BADGE active compte, pour le crédit comme pour le surplus
  // (les autres lignes BADGE et les accessoires sont ignorés). Un badge gratuit ne donne rien.
  const badge = findOrderedBadgeLine(lines);
  if (!badge || badge.unitPrice <= 0) return { outcome: "NONE" };

  // Prix effectif (remise et crédit répartis sur les lignes positives) : le crédit comme le surplus
  // l'utilisent, jamais le prix catalogue de la ligne.
  const spent = await tx.orgPrintCredit.findUnique({
    where: { requestId_kind: { requestId, kind: "SPENT" } },
    select: { amount: true },
  });
  const positiveSum = lines.filter((l) => l.lineTotal > 0).reduce((sum, l) => sum + l.lineTotal, 0);
  const unitPrice = effectiveUnitPrice(badge.unitPrice, request.acceptedTotal, Math.abs(spent?.amount ?? 0), positiveSum);

  // Prix effectif nul (arrondi) : ni crédit ni surplus.
  if (unitPrice <= 0) return { outcome: "NONE" };

  // Premières impressions seulement : une réimpression ne consomme pas la commande.
  const printed = await tx.printRequestPrint.count({ where: { requestId, reprint: false } });
  const counter = computeOnsiteCounter({
    ordered: badge.quantity,
    marginPercent: request.marginPercent ?? 0,
    printed,
  });

  if (printed < badge.quantity) {
    const unusedBadges = badge.quantity - printed;
    // Prix effectif de la ligne BADGE (suppléments compris) ; les accessoires n'entrent pas en compte.
    const amount = unusedBadges * unitPrice;
    await tx.orgPrintCredit.create({
      data: {
        orgId: request.orgId,
        kind: "EARNED",
        amount,
        quantity: unusedBadges,
        unitPrice,
        requestId,
        createdById: userId ?? null,
      },
    });
    await appendThreadEvent(tx, requestId, "ONSITE_CREDIT_EARNED", { quantity: unusedBadges, amount });
    return { outcome: "CREDIT", amount, unusedBadges };
  }

  // Le total tient dans une colonne Int : au-delà de MAX_AMOUNT on plafonne la quantité plutôt que de
  // bloquer la clôture (cas théorique : il faudrait une marge démesurée sur un très gros devis).
  const extraBadges = Math.min(counter.beyondOrder, Math.floor(MAX_AMOUNT / unitPrice));
  if (extraBadges === 0) return { outcome: "NONE" };

  // Créée directement en QUOTED (ce n'est pas une transition) : le devis est prêt, l'organisateur
  // peut l'accepter. Marge à 0 : c'est une quantité ferme, sans tolérance d'impression supplémentaire.
  const total = extraBadges * unitPrice;
  const now = new Date();
  const child = await tx.printRequest.create({
    data: {
      reference: await nextReference(tx, now),
      eventId: request.eventId,
      orgId: request.orgId,
      createdById: request.createdById,
      type: "ONSITE",
      status: "QUOTED",
      parentRequestId: requestId,
      badgeTemplateId: request.badgeTemplateId,
      badgeWidthPx: request.badgeWidthPx,
      badgeHeightPx: request.badgeHeightPx,
      badgePages: request.badgePages,
      estimatedQuantity: extraBadges,
      marginPercent: 0,
      quoteVersion: 1,
      submittedAt: now,
      quotedAt: now,
      total,
      lines: {
        create: {
          kind: "PRODUCT",
          productId: badge.productId,
          label: SUPPLEMENT_LABEL,
          optionsSnapshot: jsonOrNull(badge.optionsSnapshot),
          choices: jsonOrNull(badge.choices),
          quantity: extraBadges,
          unitPrice,
          lineTotal: total,
          position: 0,
          addedBy: "STAFF",
          // La quantité est celle du poste : l'organisateur ne la conteste pas.
          quantityOverridden: true,
        },
      },
    },
  });
  const details = { reference: child.reference, extraBadges, supplementRequestId: child.id };
  await appendThreadEvent(tx, requestId, "ONSITE_SUPPLEMENT_CREATED", details);
  await appendThreadEvent(tx, child.id, "ONSITE_SUPPLEMENT_CREATED", details);
  return { outcome: "SUPPLEMENT", supplementRequestId: child.id, extraBadges, total };
}

// Clôture hors d'`advanceStatus` (rejeu, reprise) : prend les verrous elle-même et rejoue la
// transaction si la référence de la demande complémentaire entre en collision.
export function closeOnsiteRequest(requestId: string, userId?: string): Promise<OnsiteClosure> {
  return retryOnReferenceCollision(() =>
    prisma.$transaction(async (tx) => {
      await lockRequestWithEvent(tx, requestId);
      return closeOnsiteInTx(tx, requestId, userId);
    }),
  );
}
