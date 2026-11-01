import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadProductForPricing, unitPriceFor, validateChoices } from "@/lib/print-catalog/pricing";
import { listPublishedCatalog, getProductDetail } from "@/lib/print-catalog/catalog";
import { createCordonInDb } from "./helpers/print-products-db";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe("loadProductForPricing", () => {
  it("identifiant inconnu -> null", async () => {
    expect(await loadProductForPricing("inconnu")).toBeNull();
  });

  it("le cordon en base donne 700 a x100 en Or + texte", async () => {
    const c = await createCordonInDb();
    const p = await loadProductForPricing(c.productId);
    expect(p).not.toBeNull();
    expect(p!.priceTiers.map((t) => t.minQuantity)).toEqual([100, 500]);
    expect(p!.options.map((o) => o.name)).toEqual(["Couleur", "Texte imprimé"]);
    expect(unitPriceFor(p!, 100, [
      { optionId: c.optionIds.color, valueIds: [c.valueIds.or] },
      { optionId: c.optionIds.text, text: "Forum 2026" },
    ])).toBe(700);
  });

  it("une valeur archivee reste presente (archived: true) et est refusee en VALUE_ARCHIVED", async () => {
    const c = await createCordonInDb();
    await prisma.printProductOptionValue.update({
      where: { id: c.valueIds.blanc }, data: { archived: true, archivedAt: new Date() },
    });
    const p = (await loadProductForPricing(c.productId))!;
    const color = p.options.find((o) => o.id === c.optionIds.color)!;
    expect(color.values.find((x) => x.id === c.valueIds.blanc)?.archived).toBe(true);
    const res = validateChoices(p, [{ optionId: c.optionIds.color, valueIds: [c.valueIds.blanc] }], 100);
    expect(res).toMatchObject({ ok: false, code: "VALUE_ARCHIVED" });
  });
});

describe("listPublishedCatalog", () => {
  it("exclut brouillon et archive, garde le publie", async () => {
    const pub = await createCordonInDb();
    const draft = await createCordonInDb({ published: false });
    const arch = await createCordonInDb({ archived: true });
    const ids = (await listPublishedCatalog()).map((p) => p.id);
    expect(ids).toContain(pub.productId);
    expect(ids).not.toContain(draft.productId);
    expect(ids).not.toContain(arch.productId);
  });

  it("exclut l'option archivee et la valeur archivee", async () => {
    const c = await createCordonInDb();
    await prisma.printProductOption.update({
      where: { id: c.optionIds.text }, data: { archived: true, archivedAt: new Date() },
    });
    await prisma.printProductOptionValue.update({
      where: { id: c.valueIds.noir }, data: { archived: true, archivedAt: new Date() },
    });
    const p = (await listPublishedCatalog()).find((x) => x.id === c.productId)!;
    expect(p.options.map((o) => o.id)).toEqual([c.optionIds.color]);
    expect(p.options[0].values.map((x) => x.id)).not.toContain(c.valueIds.noir);
    expect(p.options[0].values).toHaveLength(4);
  });

  it("filtre kind", async () => {
    const acc = await createCordonInDb();
    const badge = await prisma.printProduct.create({
      data: { kind: "BADGE", name: uniq("Badge PVC"), slug: uniq("badge"), basePrice: 1000, published: true },
    });
    const accIds = (await listPublishedCatalog("ACCESSORY")).map((p) => p.id);
    const badgeIds = (await listPublishedCatalog("BADGE")).map((p) => p.id);
    expect(accIds).toContain(acc.productId);
    expect(accIds).not.toContain(badge.id);
    expect(badgeIds).toContain(badge.id);
    expect(badgeIds).not.toContain(acc.productId);
  });

  it("trie par position puis nom", async () => {
    const mk = (name: string, position: number) =>
      prisma.printProduct.create({
        data: { kind: "BADGE", name, slug: uniq("s"), basePrice: 1, published: true, position },
      });
    const tag = uniq("ordre");
    const b = await mk(`${tag} B`, -900);
    const a = await mk(`${tag} A`, -900);
    const first = await mk(`${tag} Z`, -999);
    const ids = (await listPublishedCatalog("BADGE")).map((p) => p.id).filter((id) => [a.id, b.id, first.id].includes(id));
    expect(ids).toEqual([first.id, a.id, b.id]);
  });

  it("images dans l'ordre de position", async () => {
    const c = await createCordonInDb();
    const imgs = await prisma.printProductImage.findMany({ where: { productId: c.productId }, orderBy: { position: "asc" } });
    // Inverse les positions : l'ordre renvoye doit suivre `position`, pas l'insertion.
    for (const [i, img] of imgs.entries()) {
      await prisma.printProductImage.update({ where: { id: img.id }, data: { position: 10 - i } });
    }
    const p = (await listPublishedCatalog()).find((x) => x.id === c.productId)!;
    expect(p.images.map((i) => i.storageKey)).toEqual([...imgs].reverse().map((i) => i.storageKey));
  });
});

describe("getProductDetail", () => {
  it("renvoie un brouillon et un archive, null pour un id inconnu", async () => {
    const draft = await createCordonInDb({ published: false });
    const arch = await createCordonInDb({ archived: true });
    expect((await getProductDetail(draft.productId))?.published).toBe(false);
    expect((await getProductDetail(arch.productId))?.archived).toBe(true);
    expect(await getProductDetail("inconnu")).toBeNull();
  });
});
