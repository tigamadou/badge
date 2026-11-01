// Compteur et plafond de l'impression sur place (pur, sans Prisma, utilisable côté navigateur).

export type OnsiteCounterLevel = "NORMAL" | "WARNING" | "OVER" | "CAP_REACHED";

export type OnsiteCounter = {
  ordered: number;
  marginPercent: number;
  cap: number;
  printed: number;
  beyondOrder: number;
  remainingToCap: number;
  level: OnsiteCounterLevel;
};

/** Plafond = commande + marge, arrondi à l'entier supérieur (calcul entier, sans flottant). */
export function onsiteCap(ordered: number, marginPercent: number): number {
  return Math.floor((ordered * (100 + marginPercent) + 99) / 100);
}

/** Les réimpressions ne comptent jamais : `printed` ne contient que les premières impressions. */
export function computeOnsiteCounter(input: {
  ordered: number;
  marginPercent: number;
  printed: number;
}): OnsiteCounter {
  const { ordered, marginPercent, printed } = input;
  const cap = onsiteCap(ordered, marginPercent);
  let level: OnsiteCounterLevel = "NORMAL";
  if (printed >= cap) level = "CAP_REACHED";
  else if (printed > ordered) level = "OVER";
  else if (printed * 10 >= ordered * 9) level = "WARNING";
  return {
    ordered,
    marginPercent,
    cap,
    printed,
    beyondOrder: Math.max(0, printed - ordered),
    remainingToCap: Math.max(0, cap - printed),
    level,
  };
}

/** Ligne de badges commandée : première ligne produit BADGE non retirée, accessoires ignorés. */
export function orderedBadgeLine(
  lines: Array<{
    kind: string;
    quantity: number;
    unitPrice: number;
    removedAt: Date | null;
    product: { kind: string } | null;
  }>,
): { quantity: number; unitPrice: number } | null {
  const line = lines.find((l) => l.kind === "PRODUCT" && l.removedAt === null && l.product?.kind === "BADGE");
  return line ? { quantity: line.quantity, unitPrice: line.unitPrice } : null;
}
