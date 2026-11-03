import { NextResponse } from "next/server";
import type { PrintProduct } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { startingPrice } from "./pricing-core";
import type { ProductCreateInput, ProductUpdateInput } from "./input";

export type CatalogErrorCode = "NOT_FOUND" | "PRODUCT_ARCHIVED" | "UNKNOWN_OPTION" | "UNKNOWN_VALUE"
  | "OPTION_TYPE_LOCKED";

export class CatalogError extends Error {
  constructor(
    readonly code: CatalogErrorCode,
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "CatalogError";
  }
}

export function catalogErrorResponse(err: CatalogError): NextResponse {
  return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
}

export async function uniqueProductSlug(name: string): Promise<string> {
  const base = slugify(name, { maxLength: 100, fallback: "produit" });
  let candidate = base;
  // Le caller traite la rare course TOCTOU via P2002.
  for (let i = 2; ; i++) {
    const exists = await prisma.printProduct.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    candidate = `${base}-${i}`;
  }
}

export async function createProduct(input: ProductCreateInput, userId: string): Promise<PrintProduct> {
  const slug = await uniqueProductSlug(input.name);
  const last = await prisma.printProduct.aggregate({ _max: { position: true } });
  return prisma.printProduct.create({
    data: {
      kind: input.kind,
      name: input.name,
      slug,
      category: input.category ?? null,
      description: input.description ?? null,
      basePrice: input.basePrice,
      minQuantity: input.minQuantity ?? 1,
      leadTimeDays: input.leadTimeDays ?? null,
      position: (last._max.position ?? -1) + 1,
      published: false,
      createdById: userId,
    },
  });
}

export async function updateProduct(
  productId: string,
  input: ProductUpdateInput,
): Promise<{ product: PrintProduct; changed: string[] }> {
  const current = await prisma.printProduct.findUnique({ where: { id: productId } });
  if (!current) throw new CatalogError("NOT_FOUND", 404, "Produit introuvable");
  if (current.archived) throw new CatalogError("PRODUCT_ARCHIVED", 409, "Produit archivé");

  const data = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  ) as ProductUpdateInput;
  const changed = (Object.keys(data) as (keyof ProductUpdateInput)[]).filter(
    (k) => data[k] !== current[k],
  );
  const product = changed.length
    ? await prisma.printProduct.update({ where: { id: productId }, data })
    : current;
  return { product, changed };
}

export async function archiveProduct(productId: string): Promise<PrintProduct> {
  const current = await prisma.printProduct.findUnique({ where: { id: productId } });
  if (!current) throw new CatalogError("NOT_FOUND", 404, "Produit introuvable");
  if (current.archived) throw new CatalogError("PRODUCT_ARCHIVED", 409, "Produit déjà archivé");
  return prisma.printProduct.update({
    where: { id: productId },
    data: { archived: true, archivedAt: new Date(), published: false },
  });
}

export type ProductListRow = {
  id: string;
  kind: "BADGE" | "ACCESSORY";
  name: string;
  category: string | null;
  basePrice: number;
  startingPrice: number;
  published: boolean;
  archived: boolean;
  mainImageKey: string | null;
  optionCount: number;
  updatedAt: Date;
};

export async function listProducts(filter: {
  kind?: "BADGE" | "ACCESSORY";
  archived: boolean;
}): Promise<ProductListRow[]> {
  const rows = await prisma.printProduct.findMany({
    where: { archived: filter.archived, ...(filter.kind ? { kind: filter.kind } : {}) },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      priceTiers: true,
      _count: { select: { options: { where: { archived: false } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    category: r.category,
    basePrice: r.basePrice,
    startingPrice: startingPrice(r),
    published: r.published,
    archived: r.archived,
    mainImageKey: r.images[0]?.storageKey ?? null,
    optionCount: r._count.options,
    updatedAt: r.updatedAt,
  }));
}
