import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
    orderBy: { position: "asc" },
    include: { product: { select: { kind: true } } },
  });
  const badge = findOrderedBadgeLine(lines);
  if (!badge) return { outcome: "NONE" };

  // Premières impressions seulement : une réimpression ne consomme pas la commande.
  const printed = await tx.printRequestPrint.count({ where: { requestId, reprint: false } });
  const counter = computeOnsiteCounter({
    ordered: badge.quantity,
    marginPercent: request.marginPercent ?? 0,
    printed,
  });

  if (printed < badge.quantity) {
    const unusedBadges = badge.quantity - printed;
    // Prix unitaire de la ligne BADGE (suppléments compris) ; les accessoires n'entrent pas en compte.
    const amount = unusedBadges * badge.unitPrice;
    if (amount <= 0) return { outcome: "NONE" };
    await tx.orgPrintCredit.create({
      data: {
        orgId: request.orgId,
        kind: "EARNED",
        amount,
        quantity: unusedBadges,
        unitPrice: badge.unitPrice,
        requestId,
        createdById: userId ?? null,
      },
    });
    await appendThreadEvent(tx, requestId, "ONSITE_CREDIT_EARNED", { quantity: unusedBadges, amount });
    return { outcome: "CREDIT", amount, unusedBadges };
  }

  const extraBadges = counter.beyondOrder;
  if (extraBadges === 0) return { outcome: "NONE" };

  // Créée directement en QUOTED (ce n'est pas une transition) : le devis est prêt, l'organisateur
  // peut l'accepter. Marge à 0 : c'est une quantité ferme, sans tolérance d'impression supplémentaire.
  const total = extraBadges * badge.unitPrice;
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
          unitPrice: badge.unitPrice,
          lineTotal: total,
          position: 0,
          addedBy: "STAFF",
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
