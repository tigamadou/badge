import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  CatalogError,
  archiveProduct,
  catalogErrorResponse,
  createProduct,
  listProducts,
  uniqueProductSlug,
  updateProduct,
} from "@/lib/print-catalog/products";
import { productCreateSchema, productUpdateSchema } from "@/lib/print-catalog/input";
import { createCordonInDb } from "./helpers/print-products-db";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function user() {
  return prisma.user.create({ data: { email: `${uniq("u")}@x`, password: "x", name: "U" } });
}

describe("uniqueProductSlug", () => {
  it("slugifie, suffixe -2 si pris, repli sur « produit »", async () => {
    await prisma.printProduct.deleteMany({ where: { slug: { in: ["cordon-tour-de-cou-20-mm", "cordon-tour-de-cou-20-mm-2", "produit"] } } });
    expect(await uniqueProductSlug("Cordon tour de cou 20 mm")).toBe("cordon-tour-de-cou-20-mm");
    await prisma.printProduct.create({ data: { kind: "ACCESSORY", name: "x", slug: "cordon-tour-de-cou-20-mm", basePrice: 1 } });
    expect(await uniqueProductSlug("Cordon tour de cou 20 mm")).toBe("cordon-tour-de-cou-20-mm-2");
    expect(await uniqueProductSlug("!!!")).toBe("produit");
  });
});

describe("schemas", () => {
  it("minQuantity n'a pas de défaut dans le schéma partagé", () => {
    const c = productCreateSchema.parse({ kind: "BADGE", name: " A ", basePrice: 10 });
    expect(c.name).toBe("A");
    expect(c.minQuantity).toBeUndefined();
    expect(productUpdateSchema.parse({ published: true })).toEqual({ published: true });
  });
});

describe("createProduct", () => {
  it("crée un brouillon, position croissante, createdById", async () => {
    const u = await user();
    const a = await createProduct({ kind: "ACCESSORY", name: uniq("Cordon"), basePrice: 500 }, u.id);
    const b = await createProduct({ kind: "BADGE", name: uniq("Badge"), basePrice: 800, minQuantity: 20 }, u.id);
    expect(a.published).toBe(false);
    expect(a.archived).toBe(false);
    expect(a.minQuantity).toBe(1);
    expect(a.createdById).toBe(u.id);
    expect(b.minQuantity).toBe(20);
    expect(b.position).toBeGreaterThan(a.position);
  });
});

describe("updateProduct", () => {
  it("changed ne contient que les clés réellement modifiées", async () => {
    const u = await user();
    const p = await createProduct({ kind: "ACCESSORY", name: uniq("P"), basePrice: 500 }, u.id);
    const r = await updateProduct(p.id, { basePrice: 600, published: true, name: p.name });
    expect(r.changed.sort()).toEqual(["basePrice", "published"]);
    expect(r.product.slug).toBe(p.slug);
    const same = await updateProduct(p.id, { basePrice: 600, published: true });
    expect(same.changed).toEqual([]);
  });

  it("publier ne réécrit pas minQuantity", async () => {
    const u = await user();
    const p = await createProduct({ kind: "ACCESSORY", name: uniq("P"), basePrice: 500, minQuantity: 50 }, u.id);
    const r = await updateProduct(p.id, productUpdateSchema.parse({ published: true }));
    expect(r.product.minQuantity).toBe(50);
    expect(r.changed).toEqual(["published"]);
  });

  it("404 et 409 PRODUCT_ARCHIVED", async () => {
    await expect(updateProduct("inconnu", { basePrice: 1 })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    const c = await createCordonInDb({ archived: true });
    await expect(updateProduct(c.productId, { basePrice: 1 })).rejects.toMatchObject({ code: "PRODUCT_ARCHIVED", status: 409 });
  });
});

describe("archiveProduct", () => {
  it("archive et dépublie ; 404 ; 409 si déjà archivé", async () => {
    const c = await createCordonInDb();
    const p = await archiveProduct(c.productId);
    expect(p).toMatchObject({ archived: true, published: false });
    expect(p.archivedAt).toBeInstanceOf(Date);
    await expect(archiveProduct(c.productId)).rejects.toMatchObject({ code: "PRODUCT_ARCHIVED" });
    await expect(archiveProduct("inconnu")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("catalogErrorResponse", () => {
  it("renvoie { error, message } avec le statut", async () => {
    const res = catalogErrorResponse(new CatalogError("UNKNOWN_OPTION", 400, "Option inconnue"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "UNKNOWN_OPTION", message: "Option inconnue" });
  });
});

describe("listProducts", () => {
  it("filtre kind/archived, image principale, prix de départ, options non archivées", async () => {
    const c = await createCordonInDb();
    await prisma.printProductOption.update({ where: { id: c.optionIds.text }, data: { archived: true, archivedAt: new Date() } });
    const arch = await createCordonInDb({ archived: true });
    const badge = await prisma.printProduct.create({ data: { kind: "BADGE", name: uniq("B"), slug: uniq("b"), basePrice: 100 } });

    const acc = await listProducts({ kind: "ACCESSORY", archived: false });
    const row = acc.find((r) => r.id === c.productId)!;
    expect(row.startingPrice).toBe(400);
    expect(row.basePrice).toBe(500);
    expect(row.optionCount).toBe(1);
    expect(row.mainImageKey).toMatch(/^platform\/print-products\//);
    const first = await prisma.printProductImage.findFirst({ where: { productId: c.productId, position: 0 } });
    expect(row.mainImageKey).toBe(first!.storageKey);
    expect(acc.find((r) => r.id === arch.productId)).toBeUndefined();
    expect(acc.find((r) => r.id === badge.id)).toBeUndefined();

    const all = await listProducts({ archived: false });
    expect(all.find((r) => r.id === badge.id)?.mainImageKey).toBeNull();
    const archived = await listProducts({ archived: true });
    expect(archived.find((r) => r.id === arch.productId)?.archived).toBe(true);
    expect(archived.find((r) => r.id === c.productId)).toBeUndefined();
  });
});
