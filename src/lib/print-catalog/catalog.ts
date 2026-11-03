import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CatalogProduct } from "./pricing-core";

// Vitrine : options et valeurs archivees exclues, tout trie par position.
export const CATALOG_INCLUDE = {
  images: { orderBy: { position: "asc" } },
  priceTiers: { orderBy: { minQuantity: "asc" } },
  options: {
    where: { archived: false },
    orderBy: { position: "asc" },
    include: { values: { where: { archived: false }, orderBy: { position: "asc" } } },
  },
} satisfies Prisma.PrintProductInclude;

type CatalogRow = Prisma.PrintProductGetPayload<{ include: typeof CATALOG_INCLUDE }>;

export function toCatalogProduct(row: CatalogRow): CatalogProduct {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    slug: row.slug,
    category: row.category,
    description: row.description,
    leadTimeDays: row.leadTimeDays,
    basePrice: row.basePrice,
    minQuantity: row.minQuantity,
    published: row.published,
    archived: row.archived,
    images: row.images.map((i) => ({ storageKey: i.storageKey, alt: i.alt })),
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

export async function listPublishedCatalog(kind?: "BADGE" | "ACCESSORY"): Promise<CatalogProduct[]> {
  const rows = await prisma.printProduct.findMany({
    where: { published: true, archived: false, ...(kind ? { kind } : {}) },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: CATALOG_INCLUDE,
  });
  return rows.map(toCatalogProduct);
}

// Ecran staff : meme forme, brouillon ou archive compris.
export async function getProductDetail(productId: string): Promise<CatalogProduct | null> {
  const row = await prisma.printProduct.findUnique({ where: { id: productId }, include: CATALOG_INCLUDE });
  return row ? toCatalogProduct(row) : null;
}
