import { prisma } from "@/lib/prisma";
import type { ProductForPricing } from "./pricing-core";

export * from "./pricing-core";

// Charge un produit pour le calcul de prix et la validation. Inclut les options et valeurs
// archivees (validateChoices les refuse). Renvoie null uniquement pour un identifiant inconnu.
export async function loadProductForPricing(productId: string): Promise<ProductForPricing | null> {
  const row = await prisma.printProduct.findUnique({
    where: { id: productId },
    include: {
      priceTiers: { orderBy: { minQuantity: "asc" } },
      options: {
        orderBy: { position: "asc" },
        include: { values: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    basePrice: row.basePrice,
    minQuantity: row.minQuantity,
    published: row.published,
    archived: row.archived,
    priceTiers: row.priceTiers.map((t) => ({ minQuantity: t.minQuantity, unitPrice: t.unitPrice })),
    options: row.options.map((o) => ({
      id: o.id, name: o.name, help: o.help, type: o.type, required: o.required,
      priceDelta: o.priceDelta, maxLength: o.maxLength, archived: o.archived,
      values: o.values.map((v) => ({
        id: v.id, label: v.label, colorHex: v.colorHex, imageKey: v.imageKey,
        priceDelta: v.priceDelta, archived: v.archived,
      })),
    })),
  };
}
