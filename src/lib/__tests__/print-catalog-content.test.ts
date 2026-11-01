import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  imagesInputSchema,
  optionsInputSchema,
  tiersInputSchema,
  type OptionInput,
} from "@/lib/print-catalog/input";
import { CatalogError } from "@/lib/print-catalog/products";
import { getProductDetail } from "@/lib/print-catalog/catalog";
import { tierPriceFor } from "@/lib/print-catalog/pricing-core";
import { replaceImages, replaceTiers, syncOptions } from "@/lib/print-catalog/content";
import { createCordonInDb } from "./helpers/print-products-db";

const key = () => `platform/print-products/${randomUUID()}.jpg`;
const img = (alt = "") => ({ storageKey: key(), alt });

function opt(over: Partial<OptionInput> = {}): OptionInput {
  return {
    name: "Matière", help: null, type: "CHOICE", required: false, priceDelta: 0, maxLength: null,
    values: [{ label: "Nylon", colorHex: null, imageKey: null, priceDelta: 0 }],
    ...over,
  };
}
const textOpt = (over: Partial<OptionInput> = {}) =>
  opt({ name: "Texte", type: "TEXT", priceDelta: 150, maxLength: 30, values: [], ...over });

async function codeOf(p: Promise<unknown>) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(CatalogError);
  return err as CatalogError;
}

describe("schémas", () => {
  it("images : 10 au plus, clé d'upload, clés distinctes", () => {
    const ten = Array.from({ length: 10 }, () => img());
    expect(imagesInputSchema.safeParse({ images: ten }).success).toBe(true);
    expect(imagesInputSchema.safeParse({ images: [...ten, img()] }).success).toBe(false);
    expect(imagesInputSchema.safeParse({ images: [{ storageKey: "orgs/x/images/a.jpg", alt: "" }] }).success).toBe(false);
    const a = img();
    expect(imagesInputSchema.safeParse({ images: [a, { ...a }] }).success).toBe(false);
    expect(imagesInputSchema.safeParse({ images: [{ ...img(), alt: "x".repeat(201) }] }).success).toBe(false);
  });

  it("paliers : minQuantity distincts, bornes", () => {
    expect(tiersInputSchema.safeParse({ tiers: [{ minQuantity: 100, unitPrice: 450 }, { minQuantity: 500, unitPrice: 400 }] }).success).toBe(true);
    expect(tiersInputSchema.safeParse({ tiers: [{ minQuantity: 100, unitPrice: 450 }, { minQuantity: 100, unitPrice: 400 }] }).success).toBe(false);
    expect(tiersInputSchema.safeParse({ tiers: [{ minQuantity: 1, unitPrice: 450 }] }).success).toBe(false);
    expect(tiersInputSchema.safeParse({ tiers: Array.from({ length: 21 }, (_, i) => ({ minQuantity: i + 2, unitPrice: 1 })) }).success).toBe(false);
  });

  const ok = (o: OptionInput) => optionsInputSchema.safeParse({ options: [o] }).success;
  const colorVal = (colorHex: string | null) => ({ label: "Rouge", colorHex, imageKey: null, priceDelta: 0 });

  it("options : règles par type", () => {
    expect(ok(opt())).toBe(true);
    expect(ok(textOpt())).toBe(true);
    expect(ok(opt({ name: "Fichier", type: "FILE", values: [], priceDelta: 0 }))).toBe(true);
    expect(ok(opt({ type: "COLOR", values: [colorVal("#D32F2F")] }))).toBe(true);
    expect(ok(opt({ type: "COLOR", values: [colorVal(null)] }))).toBe(false);
    expect(ok(opt({ type: "COLOR", values: [colorVal("rouge")] }))).toBe(false);
    expect(ok(textOpt({ maxLength: null }))).toBe(false);
    for (const type of ["CHOICE", "MULTI_CHOICE", "COLOR", "QUANTITY_SPLIT"] as const) {
      expect(ok(opt({ type, values: [] }))).toBe(false);
      expect(ok(opt({ type, priceDelta: 100, values: [colorVal("#000000")] }))).toBe(false);
    }
    expect(ok(opt({ type: "FILE", values: [colorVal(null)] }))).toBe(false);
    expect(ok(textOpt({ values: [colorVal(null)] }))).toBe(false);
  });

  it("options : identifiants en double, 30 options, imageKey d'upload", () => {
    const dupValues = opt({
      values: [
        { id: "v1", label: "A", colorHex: null, imageKey: null, priceDelta: 0 },
        { id: "v1", label: "B", colorHex: null, imageKey: null, priceDelta: 0 },
      ],
    });
    expect(ok(dupValues)).toBe(false);
    expect(optionsInputSchema.safeParse({ options: [opt({ id: "o1" }), opt({ id: "o1" })] }).success).toBe(false);
    expect(optionsInputSchema.safeParse({ options: Array.from({ length: 31 }, () => opt()) }).success).toBe(false);
    expect(ok(opt({ values: [{ label: "A", colorHex: null, imageKey: "x/y.jpg", priceDelta: 0 }] }))).toBe(false);
    expect(ok(opt({ values: [{ label: "A", colorHex: null, imageKey: key(), priceDelta: 0 }] }))).toBe(true);
  });
});

describe("replaceImages", () => {
  it("remplace puis réordonne (D, A, B)", async () => {
    const { productId } = await createCordonInDb();
    const [a, b, c, d] = [img("A"), img("B"), img("C"), img("D")];
    await replaceImages(productId, [a, b, c, d]);
    let rows = await prisma.printProductImage.findMany({ where: { productId }, orderBy: { position: "asc" } });
    expect(rows.map((r) => r.alt)).toEqual(["A", "B", "C", "D"]);
    await replaceImages(productId, [d, a, b]);
    rows = await prisma.printProductImage.findMany({ where: { productId }, orderBy: { position: "asc" } });
    expect(rows.map((r) => [r.alt, r.position])).toEqual([["D", 0], ["A", 1], ["B", 2]]);
    await replaceImages(productId, []);
    expect(await prisma.printProductImage.count({ where: { productId } })).toBe(0);
  });

  it("404 / 409, rien n'est écrit", async () => {
    expect((await codeOf(replaceImages("inconnu", [img()]))).status).toBe(404);
    const { productId } = await createCordonInDb({ archived: true });
    const err = await codeOf(replaceImages(productId, []));
    expect([err.status, err.code]).toEqual([409, "PRODUCT_ARCHIVED"]);
    expect(await prisma.printProductImage.count({ where: { productId } })).toBe(4);
  });
});

describe("replaceTiers", () => {
  it("remplace les paliers ; tierPriceFor relit 450 à 100", async () => {
    const { productId } = await createCordonInDb();
    await replaceTiers(productId, [{ minQuantity: 500, unitPrice: 400 }, { minQuantity: 100, unitPrice: 450 }]);
    const product = (await getProductDetail(productId))!;
    expect(product.priceTiers).toHaveLength(2);
    expect(tierPriceFor(product, 100)).toBe(450);
    expect(tierPriceFor(product, 500)).toBe(400);
    expect(tierPriceFor(product, 99)).toBe(500);
    await replaceTiers(productId, []);
    expect(await prisma.printProductPriceTier.count({ where: { productId } })).toBe(0);
  });

  it("404 / 409", async () => {
    expect((await codeOf(replaceTiers("inconnu", []))).status).toBe(404);
    const { productId } = await createCordonInDb({ archived: true });
    expect((await codeOf(replaceTiers(productId, []))).code).toBe("PRODUCT_ARCHIVED");
    expect(await prisma.printProductPriceTier.count({ where: { productId } })).toBe(2);
  });
});

const colorValue = (label: string, colorHex: string, priceDelta = 0, id?: string) => ({
  ...(id ? { id } : {}), label, colorHex, imageKey: null, priceDelta,
});

describe("syncOptions", () => {
  it("crée l'option COLOR à 5 valeurs et l'option TEXT", async () => {
    const product = await prisma.printProduct.create({ data: { kind: "ACCESSORY", name: "x", slug: `s-${randomUUID()}`, basePrice: 500 } });
    await syncOptions(product.id, [
      opt({
        name: "Couleur", type: "COLOR", required: true,
        values: [
          colorValue("Rouge", "#D32F2F"), colorValue("Bleu", "#1976D2"), colorValue("Noir", "#000000"),
          colorValue("Blanc", "#FFFFFF"), colorValue("Or", "#C9A227", 100),
        ],
      }),
      textOpt({ name: "Texte imprimé", help: "30 caractères" }),
    ]);
    const detail = (await getProductDetail(product.id))!;
    expect(detail.options.map((o) => [o.name, o.type])).toEqual([["Couleur", "COLOR"], ["Texte imprimé", "TEXT"]]);
    expect(detail.options[0].values.map((v) => [v.label, v.priceDelta])).toEqual([
      ["Rouge", 0], ["Bleu", 0], ["Noir", 0], ["Blanc", 0], ["Or", 100],
    ]);
    expect(detail.options[1]).toMatchObject({ priceDelta: 150, maxLength: 30, help: "30 caractères" });
  });

  it("retirer Blanc l'archive, renommer Or garde son id, retirer le texte archive l'option", async () => {
    const { productId, optionIds, valueIds } = await createCordonInDb();
    const color = opt({
      id: optionIds.color, name: "Couleur", type: "COLOR", required: true,
      values: [
        colorValue("Rouge", "#D32F2F", 0, valueIds.rouge),
        colorValue("Bleu", "#1976D2", 0, valueIds.bleu),
        colorValue("Noir", "#000000", 0, valueIds.noir),
        colorValue("Or foncé", "#C9A227", 100, valueIds.or),
      ],
    });
    await syncOptions(productId, [color]);
    const values = await prisma.printProductOptionValue.findMany({ where: { optionId: optionIds.color }, orderBy: { position: "asc" } });
    const blanc = values.find((v) => v.id === valueIds.blanc)!;
    expect(blanc.archived).toBe(true);
    expect(blanc.archivedAt).toBeInstanceOf(Date);
    const live = values.filter((v) => !v.archived);
    expect(live.map((v) => v.id)).toEqual([valueIds.rouge, valueIds.bleu, valueIds.noir, valueIds.or]);
    expect(live.map((v) => v.position)).toEqual([0, 1, 2, 3]);
    expect(live[3].label).toBe("Or foncé");
    const text = await prisma.printProductOption.findUniqueOrThrow({ where: { id: optionIds.text } });
    expect(text.archived).toBe(true);
    expect(text.archivedAt).toBeInstanceOf(Date);
    const detail = (await getProductDetail(productId))!;
    expect(detail.options.map((o) => o.id)).toEqual([optionIds.color]);
    // Ré-envoi : l'option déjà archivée absente n'est pas ré-archivée.
    const archivedAt = text.archivedAt;
    await syncOptions(productId, [color]);
    expect((await prisma.printProductOption.findUniqueOrThrow({ where: { id: optionIds.text } })).archivedAt).toEqual(archivedAt);
  });

  it("met à jour une option existante et crée une valeur au passage", async () => {
    const { productId, optionIds } = await createCordonInDb();
    await syncOptions(productId, [
      opt({ id: optionIds.color, name: "Teinte", type: "CHOICE", required: false, help: "aide", values: [
        { label: "Neuf", colorHex: null, imageKey: key(), priceDelta: 5 },
      ] }),
      textOpt({ id: optionIds.text, priceDelta: 200, maxLength: 40 }),
    ]);
    const detail = (await getProductDetail(productId))!;
    expect(detail.options[0]).toMatchObject({ id: optionIds.color, name: "Teinte", type: "CHOICE", help: "aide" });
    expect(detail.options[0].values.map((v) => v.label)).toEqual(["Neuf"]);
    expect(detail.options[1]).toMatchObject({ id: optionIds.text, priceDelta: 200, maxLength: 40 });
  });

  it("option d'un autre produit ou archivée : UNKNOWN_OPTION sans rien écrire", async () => {
    const a = await createCordonInDb();
    const b = await createCordonInDb();
    const err = await codeOf(syncOptions(a.productId, [
      opt({ name: "Nouvelle" }),
      opt({ id: b.optionIds.color, name: "Volée" }),
    ]));
    expect([err.status, err.code]).toEqual([400, "UNKNOWN_OPTION"]);
    expect(await prisma.printProductOption.count({ where: { productId: a.productId } })).toBe(2);
    expect((await prisma.printProductOption.findUniqueOrThrow({ where: { id: b.optionIds.color } })).name).toBe("Couleur");
    await prisma.printProductOption.update({ where: { id: a.optionIds.text }, data: { archived: true } });
    expect((await codeOf(syncOptions(a.productId, [textOpt({ id: a.optionIds.text })]))).code).toBe("UNKNOWN_OPTION");
  });

  it("valeur inconnue, d'une autre option ou archivée : UNKNOWN_VALUE sans rien écrire", async () => {
    const a = await createCordonInDb();
    const base = { id: a.optionIds.color, name: "Couleur", type: "COLOR" as const };
    const bad = (id: string) => opt({ ...base, values: [colorValue("Rouge", "#D32F2F", 0, id)] });
    const e1 = await codeOf(syncOptions(a.productId, [bad("inconnue")]));
    expect([e1.status, e1.code]).toEqual([400, "UNKNOWN_VALUE"]);
    const other = await createCordonInDb();
    expect((await codeOf(syncOptions(a.productId, [bad(other.valueIds.rouge)]))).code).toBe("UNKNOWN_VALUE");
    await prisma.printProductOptionValue.update({ where: { id: a.valueIds.rouge }, data: { archived: true } });
    expect((await codeOf(syncOptions(a.productId, [bad(a.valueIds.rouge)]))).code).toBe("UNKNOWN_VALUE");
    expect(await prisma.printProductOption.count({ where: { productId: a.productId, archived: true } })).toBe(0);
  });

  it("404 / 409", async () => {
    expect((await codeOf(syncOptions("inconnu", []))).status).toBe(404);
    const { productId } = await createCordonInDb({ archived: true });
    expect((await codeOf(syncOptions(productId, []))).code).toBe("PRODUCT_ARCHIVED");
    expect(await prisma.printProductOption.count({ where: { productId, archived: true } })).toBe(0);
  });
});
