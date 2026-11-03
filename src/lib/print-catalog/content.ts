import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CatalogError } from "./products";
import type { ImageInput, OptionInput, OptionValueInput, TierInput } from "./input";

type Tx = Prisma.TransactionClient;

async function assertEditable(tx: Tx, productId: string): Promise<void> {
  const product = await tx.printProduct.findUnique({ where: { id: productId }, select: { archived: true } });
  if (!product) throw new CatalogError("NOT_FOUND", 404, "Produit introuvable");
  if (product.archived) throw new CatalogError("PRODUCT_ARCHIVED", 409, "Produit archivé");
}

// Seules les lignes sont supprimees : l'objet S3 reste (une image peut etre reutilisee).
export async function replaceImages(productId: string, images: ImageInput[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertEditable(tx, productId);
    await tx.printProductImage.deleteMany({ where: { productId } });
    await tx.printProductImage.createMany({
      data: images.map((i, position) => ({ productId, storageKey: i.storageKey, alt: i.alt, position })),
    });
  });
}

export async function replaceTiers(productId: string, tiers: TierInput[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertEditable(tx, productId);
    await tx.printProductPriceTier.deleteMany({ where: { productId } });
    await tx.printProductPriceTier.createMany({
      data: tiers.map((t) => ({ productId, minQuantity: t.minQuantity, unitPrice: t.unitPrice })),
    });
  });
}

function valueData(v: OptionValueInput, position: number) {
  return { label: v.label, colorHex: v.colorHex, imageKey: v.imageKey, priceDelta: v.priceDelta, position };
}

async function syncValues(tx: Tx, optionId: string, values: OptionValueInput[], isNew: boolean): Promise<void> {
  const existing = isNew
    ? []
    : await tx.printProductOptionValue.findMany({ where: { optionId, archived: false }, select: { id: true } });
  const known = new Set(existing.map((v) => v.id));
  const kept = new Set<string>();
  for (let position = 0; position < values.length; position++) {
    const v = values[position];
    if (v.id === undefined) {
      await tx.printProductOptionValue.create({ data: { optionId, ...valueData(v, position) } });
      continue;
    }
    if (!known.has(v.id)) throw new CatalogError("UNKNOWN_VALUE", 400, "Valeur d'option inconnue");
    kept.add(v.id);
    await tx.printProductOptionValue.update({ where: { id: v.id }, data: valueData(v, position) });
  }
  const dropped = existing.filter((v) => !kept.has(v.id)).map((v) => v.id);
  if (dropped.length > 0) {
    await tx.printProductOptionValue.updateMany({
      where: { id: { in: dropped } },
      data: { archived: true, archivedAt: new Date() },
    });
  }
}

// Les options et valeurs retirees sont archivees (jamais supprimees) : les demandes
// d'impression et les configurations figees gardent des identifiants stables.
export async function syncOptions(productId: string, options: OptionInput[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertEditable(tx, productId);
    const existing = await tx.printProductOption.findMany({
      where: { productId, archived: false },
      select: { id: true, type: true },
    });
    const known = new Map(existing.map((o) => [o.id, o.type]));
    const kept = new Set<string>();
    for (let position = 0; position < options.length; position++) {
      const o = options[position];
      const data = {
        name: o.name, help: o.help, type: o.type, required: o.required,
        priceDelta: o.priceDelta, maxLength: o.maxLength, position,
      };
      if (o.id === undefined) {
        const created = await tx.printProductOption.create({ data: { productId, ...data } });
        await syncValues(tx, created.id, o.values, true);
        continue;
      }
      const knownType = known.get(o.id);
      if (knownType === undefined) throw new CatalogError("UNKNOWN_OPTION", 400, "Option inconnue");
      // Changer le type invaliderait les choix deja enregistres : creer une nouvelle option.
      if (knownType !== o.type) {
        throw new CatalogError(
          "OPTION_TYPE_LOCKED", 400,
          "Le type d'une option enregistrée ne peut pas changer : supprimez l'option et créez-en une nouvelle.",
        );
      }
      kept.add(o.id);
      await tx.printProductOption.update({ where: { id: o.id }, data });
      await syncValues(tx, o.id, o.values, false);
    }
    const dropped = existing.filter((o) => !kept.has(o.id)).map((o) => o.id);
    if (dropped.length > 0) {
      await tx.printProductOption.updateMany({
        where: { id: { in: dropped } },
        data: { archived: true, archivedAt: new Date() },
      });
    }
  });
}
