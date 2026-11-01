import { describe, it, expect, beforeEach } from "vitest";
import { Prisma, type PrintRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatFcfa } from "@/lib/print-catalog/pricing";
import { PrintRequestError } from "@/lib/print-requests/errors";
import {
  choiceFailureToError,
  setOrganizerProducts,
} from "@/lib/print-requests/content";
import { optionChoiceSchema, organizerProductsSchema } from "@/lib/print-requests/inputs";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

let fx: PrintFixture;
beforeEach(async () => {
  fx = await seedPrintFixture();
});

const reject = async (p: Promise<unknown>) =>
  p.then(() => null, (e) => e as PrintRequestError);
const thread = (id: string) =>
  prisma.printRequestMessage.findMany({ where: { requestId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
const lines = (id: string) =>
  prisma.printQuoteLine.findMany({ where: { requestId: id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });

// Demande ADVANCE avec 3 badges réservés.
async function requestWithBadges(status: PrintRequestStatus = "DRAFT", count = 3) {
  const r = await makeRequest(fx, { status });
  for (let i = 0; i < count; i++) {
    await prisma.printRequestItem.create({
      data: { requestId: r.id, registrationId: fx.approved[i].id, position: i },
    });
  }
  return r;
}
const badge = (over = {}) => ({ productId: fx.badgeProduct.id, quantity: null, choices: [], ...over });
const lanyard = (over = {}) => ({ productId: fx.lanyard.id, quantity: null, choices: [], ...over });
const set = (requestId: string, products: Parameters<typeof setOrganizerProducts>[0]["products"], userId = fx.owner.id) =>
  setOrganizerProducts({ requestId, eventId: fx.event.id, userId, products });

describe("schémas", () => {
  it("optionChoiceSchema : forme d'OptionChoice", () => {
    expect(optionChoiceSchema.safeParse({ optionId: "o", valueIds: ["a"], text: "t", fileKey: "k", split: [{ valueId: "a", quantity: 2 }] }).success).toBe(true);
    expect(optionChoiceSchema.safeParse({ valueIds: ["a"] }).success).toBe(false);
    expect(optionChoiceSchema.safeParse({ optionId: "o", split: [{ valueId: "a", quantity: 1.5 }] }).success).toBe(false);
  });
  it("organizerProductsSchema : quantité nulle ou bornée, 30 produits au plus", () => {
    const item = { productId: "p", quantity: null, choices: [] };
    expect(organizerProductsSchema.safeParse([item, { ...item, quantity: 5 }]).success).toBe(true);
    expect(organizerProductsSchema.safeParse([{ ...item, quantity: 0 }]).success).toBe(false);
    expect(organizerProductsSchema.safeParse([{ ...item, quantity: 1_000_001 }]).success).toBe(false);
    expect(organizerProductsSchema.safeParse(Array(31).fill(item)).success).toBe(false);
    expect(organizerProductsSchema.safeParse([]).success).toBe(true);
  });
});

describe("setOrganizerProducts — création", () => {
  it("3 badges : support 3 x 1500 et cordon 3 x 500, total 6000 ; quantité saisie du support ignorée", async () => {
    const r = await requestWithBadges();
    const res = await set(r.id, [badge({ quantity: 99 }), lanyard()]);
    expect(res.total).toBe(6000);
    expect(res.revised).toBe(false);
    expect(res.lines.map((l) => [l.label, l.quantity, l.unitPrice, l.lineTotal, l.position, l.addedBy, l.kind])).toEqual([
      ["Support badge PVC", 3, 1500, 4500, 0, "ORGANIZER", "PRODUCT"],
      ["Cordon", 3, 500, 1500, 1, "ORGANIZER", "PRODUCT"],
    ]);
    expect(res.lines[0].optionsSnapshot).toEqual([]);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).total).toBe(6000);
    expect(await thread(r.id)).toHaveLength(0);
  });

  it("accessoire à 5 : 2500 ; le support passé après l'accessoire reste en position 0", async () => {
    const r = await requestWithBadges();
    const res = await set(r.id, [lanyard({ quantity: 5 }), badge()]);
    expect(res.lines.map((l) => [l.label, l.quantity, l.lineTotal])).toEqual([
      ["Support badge PVC", 3, 4500],
      ["Cordon", 5, 2500],
    ]);
    expect(res.total).toBe(7000);
  });

  it("type ONSITE : le nombre de badges est la quantité estimée", async () => {
    const r = await makeRequest(fx, { status: "DRAFT", type: "ONSITE", estimatedQuantity: 10 });
    const res = await set(r.id, [badge()]);
    expect(res.lines[0].quantity).toBe(10);
    expect(res.total).toBe(15000);
  });
});

describe("setOrganizerProducts — refus", () => {
  it("aucun badge -> 409 BADGE_COUNT_REQUIRED", async () => {
    const r = await requestWithBadges("DRAFT", 0);
    const err = await reject(set(r.id, [badge()]));
    expect(err).toMatchObject({ code: "BADGE_COUNT_REQUIRED", status: 409 });
    expect(await lines(r.id)).toHaveLength(0);
  });

  it("deux supports, ou aucun -> BADGE_PRODUCT_REQUIRED", async () => {
    const r = await requestWithBadges();
    const other = await prisma.printProduct.create({
      data: { kind: "BADGE", name: "Autre", slug: `autre-${Date.now()}`, basePrice: 1, published: true },
    });
    expect(await reject(set(r.id, [badge(), badge({ productId: other.id })]))).toMatchObject({ code: "BADGE_PRODUCT_REQUIRED", status: 400 });
    expect(await reject(set(r.id, [lanyard()]))).toMatchObject({ code: "BADGE_PRODUCT_REQUIRED" });
    expect(await reject(set(r.id, []))).toMatchObject({ code: "BADGE_PRODUCT_REQUIRED" });
  });

  it("même produit deux fois -> VALIDATION", async () => {
    const r = await requestWithBadges();
    expect(await reject(set(r.id, [badge(), lanyard(), lanyard()]))).toMatchObject({ code: "VALIDATION" });
  });

  it("produit inconnu, archivé ou brouillon -> PRODUCT_UNAVAILABLE { productId }", async () => {
    const r = await requestWithBadges();
    expect(await reject(set(r.id, [badge(), lanyard({ productId: "inconnu" })]))).toMatchObject({
      code: "PRODUCT_UNAVAILABLE", status: 400, details: { productId: "inconnu" },
    });
    await prisma.printProduct.update({ where: { id: fx.lanyard.id }, data: { archived: true } });
    expect(await reject(set(r.id, [badge(), lanyard()]))).toMatchObject({
      code: "PRODUCT_UNAVAILABLE", details: { productId: fx.lanyard.id },
    });
    await prisma.printProduct.update({ where: { id: fx.lanyard.id }, data: { archived: false, published: false } });
    expect(await reject(set(r.id, [badge(), lanyard()]))).toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
    expect(await lines(r.id)).toHaveLength(0);
  });

  it("choix invalide -> INVALID_CHOICES { productId, code, optionId }", async () => {
    const r = await requestWithBadges();
    const err = await reject(set(r.id, [badge(), lanyard({ choices: [{ optionId: "zzz", text: "x" }] })]));
    expect(err).toMatchObject({
      code: "INVALID_CHOICES", status: 400,
      details: { productId: fx.lanyard.id, code: "UNKNOWN_OPTION", optionId: "zzz" },
    });
  });

  it("minQuantity 10 avec 3 badges -> BELOW_MIN_QUANTITY { productId, minQuantity }", async () => {
    const r = await requestWithBadges();
    await prisma.printProduct.update({ where: { id: fx.lanyard.id }, data: { minQuantity: 10 } });
    expect(await reject(set(r.id, [badge(), lanyard()]))).toMatchObject({
      code: "BELOW_MIN_QUANTITY", status: 400, details: { productId: fx.lanyard.id, minQuantity: 10 },
    });
  });

  it("choiceFailureToError : les trois familles de codes", () => {
    const product = { id: "p", minQuantity: 4 };
    expect(choiceFailureToError(product, { ok: false, code: "PRODUCT_UNAVAILABLE" }).code).toBe("PRODUCT_UNAVAILABLE");
    expect(choiceFailureToError(product, { ok: false, code: "QUANTITY_BELOW_MINIMUM" }).details).toEqual({ productId: "p", minQuantity: 4 });
    expect(choiceFailureToError(product, { ok: false, code: "SPLIT_MISMATCH", optionId: "o" }).details).toEqual({ productId: "p", code: "SPLIT_MISMATCH", optionId: "o" });
  });

  it("statut verrouillé : demande ACCEPTED -> QUOTE_ACCEPTED", async () => {
    const r = await requestWithBadges("ACCEPTED");
    expect(await reject(set(r.id, [badge()]))).toMatchObject({ code: "QUOTE_ACCEPTED" });
  });

  it("demande d'un autre évènement -> NOT_FOUND", async () => {
    const r = await requestWithBadges();
    const err = await reject(setOrganizerProducts({ requestId: r.id, eventId: "autre", userId: fx.owner.id, products: [badge()] }));
    expect(err).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("setOrganizerProducts — fichiers", () => {
  async function withFileOption() {
    const option = await prisma.printProductOption.create({
      data: { productId: fx.lanyard.id, name: "Logo", type: "FILE", required: false, priceDelta: 200, position: 0 },
    });
    return option.id;
  }

  it("clé d'un autre évènement ou mal formée -> INVALID_CHOICES", async () => {
    const r = await requestWithBadges();
    const optionId = await withFileOption();
    for (const fileKey of [
      "print-requests/autre-evenement/logo.png",
      `print-requests/${fx.event.id}/../x.png`,
      `print-requests/${fx.event.id}/sous/dossier.png`,
      `print-requests/${fx.event.id}/${"a".repeat(300)}`,
      "print-requests/staff/logo.png",
    ]) {
      const err = await reject(set(r.id, [badge(), lanyard({ choices: [{ optionId, fileKey }] })]));
      expect(err, fileKey).toMatchObject({ code: "INVALID_CHOICES", details: { code: "INVALID_FILE", optionId } });
    }
    expect(await lines(r.id)).toHaveLength(0);
  });

  it("clé de l'évènement acceptée : supplément et fichier dans l'instantané", async () => {
    const r = await requestWithBadges();
    const optionId = await withFileOption();
    const fileKey = `print-requests/${fx.event.id}/logo.png`;
    const res = await set(r.id, [badge(), lanyard({ choices: [{ optionId, fileKey }] })]);
    const cord = res.lines[1];
    expect(cord.unitPrice).toBe(700);
    expect(cord.optionsSnapshot).toEqual([
      expect.objectContaining({ optionName: "Logo", fileKey, priceDelta: 200 }),
    ]);
    expect(cord.choices).toEqual([{ optionId, fileKey }]);
  });
});

describe("setOrganizerProducts — comparaison avec les lignes existantes", () => {
  it("DRAFT : retirer le cordon supprime la ligne, sans entrée", async () => {
    const r = await requestWithBadges("DRAFT");
    await set(r.id, [badge(), lanyard()]);
    const res = await set(r.id, [badge()]);
    expect(res.lines.map((l) => l.label)).toEqual(["Support badge PVC"]);
    expect(res.total).toBe(4500);
    expect(await lines(r.id)).toHaveLength(1);
    expect(await thread(r.id)).toHaveLength(0);
  });

  it("SUBMITTED : retirer le cordon pose removedAt et écrit « Ligne retirée : Cordon »", async () => {
    const r = await requestWithBadges("SUBMITTED");
    // Autre auteur pour la première saisie : le fil ne regroupe pas les deux entrées.
    await set(r.id, [badge(), lanyard()], fx.manager.id);
    const res = await set(r.id, [badge()]);
    expect(res.total).toBe(4500);
    const all = await lines(r.id);
    expect(all).toHaveLength(2);
    expect(all.find((l) => l.label === "Cordon")?.removedAt).not.toBeNull();
    const events = await thread(r.id);
    expect(events.map((e) => e.eventType)).toEqual(["LINES_CHANGED", "LINES_CHANGED"]);
    expect(events[1].body).toBe("Ligne retirée : Cordon");
    expect(events[1].side).toBe("ORGANIZER");
  });

  it("SUBMITTED : ajout tracé, renvoi à l'identique -> aucune nouvelle entrée", async () => {
    const r = await requestWithBadges("SUBMITTED");
    await set(r.id, [badge()]);
    const events1 = await thread(r.id);
    expect(events1.map((e) => e.body)).toEqual([`Ligne ajoutée : Support badge PVC (3 × ${formatFcfa(1500)})`]);
    await set(r.id, [badge()]);
    expect(await thread(r.id)).toHaveLength(1);
  });

  it("changer la quantité d'un accessoire : modification tracée, prix recalculé", async () => {
    const r = await requestWithBadges("SUBMITTED");
    await set(r.id, [badge(), lanyard({ quantity: 5 })], fx.manager.id);
    const res = await set(r.id, [badge(), lanyard({ quantity: 8 })]);
    expect(res.lines[1]).toMatchObject({ quantity: 8, lineTotal: 4000 });
    const body = (await thread(r.id)).at(-1)!.body;
    expect(body).toBe("Ligne modifiée : Cordon (quantité 5 → 8)");
  });

  it("changer de support : l'ancien est retiré, le nouveau ajouté en position 0", async () => {
    const r = await requestWithBadges("SUBMITTED");
    await set(r.id, [badge(), lanyard()]);
    const other = await prisma.printProduct.create({
      data: { kind: "BADGE", name: "Support luxe", slug: `luxe-${Date.now()}`, basePrice: 2000, published: true },
    });
    const res = await set(r.id, [badge({ productId: other.id }), lanyard()]);
    expect(res.lines.map((l) => [l.label, l.position, l.lineTotal])).toEqual([
      ["Support luxe", 0, 6000], ["Cordon", 1, 1500],
    ]);
  });

  it("réordonner sans rien changer met à jour la position, sans entrée ni révision", async () => {
    const r = await requestWithBadges("SUBMITTED");
    const a = await prisma.printProduct.create({
      data: { kind: "ACCESSORY", name: "Stylo", slug: `stylo-${Date.now()}`, basePrice: 100, published: true },
    });
    await set(r.id, [badge(), lanyard(), lanyard({ productId: a.id })]);
    const before = (await thread(r.id)).length;
    const res = await set(r.id, [badge(), lanyard({ productId: a.id }), lanyard()]);
    expect(res.lines.map((l) => l.label)).toEqual(["Support badge PVC", "Stylo", "Cordon"]);
    expect(await thread(r.id)).toHaveLength(before);
  });

  it("un produit déjà en ligne mais archivé depuis, inchangé, ne bloque pas l'enregistrement", async () => {
    const r = await requestWithBadges("SUBMITTED");
    await set(r.id, [badge(), lanyard()]);
    await prisma.printProduct.update({ where: { id: fx.lanyard.id }, data: { archived: true } });
    const res = await set(r.id, [badge(), lanyard()]);
    expect(res.lines).toHaveLength(2);
  });

  it("choix enregistrés absents (null) : équivalents à une liste vide", async () => {
    const r = await requestWithBadges("SUBMITTED");
    await set(r.id, [badge()]);
    await prisma.printQuoteLine.updateMany({ where: { requestId: r.id }, data: { choices: Prisma.DbNull } });
    const before = (await thread(r.id)).length;
    await set(r.id, [badge()]);
    expect(await thread(r.id)).toHaveLength(before);
  });

  it("les lignes du staff ne sont pas touchées", async () => {
    const r = await requestWithBadges("SUBMITTED");
    await prisma.printQuoteLine.create({
      data: { requestId: r.id, kind: "CUSTOM", label: "Livraison", quantity: 1, unitPrice: 1000, lineTotal: 1000, position: 5, addedBy: "STAFF" },
    });
    const res = await set(r.id, [badge()]);
    expect(res.lines.map((l) => l.label)).toEqual(["Support badge PVC", "Livraison"]);
    expect(res.total).toBe(5500);
  });

  it("QUOTED -> SUBMITTED, revised: true, QUOTE_REVISION avant LINES_CHANGED", async () => {
    const r = await requestWithBadges("QUOTED");
    const res = await set(r.id, [badge()]);
    expect(res.revised).toBe(true);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("SUBMITTED");
    expect((await thread(r.id)).map((e) => e.eventType)).toEqual(["QUOTE_REVISION", "LINES_CHANGED"]);
  });

  it("QUOTED : produits identiques -> reste QUOTED, aucune entrée ; une position seule est enregistrée", async () => {
    const r = await requestWithBadges("QUOTED");
    await prisma.printRequest.update({ where: { id: r.id }, data: { status: "SUBMITTED" } });
    await set(r.id, [badge(), lanyard()]);
    await prisma.printRequest.update({ where: { id: r.id }, data: { status: "QUOTED" } });
    const before = await thread(r.id);
    const res = await set(r.id, [badge(), lanyard()]);
    expect(res.revised).toBe(false);
    expect(res.lines).toHaveLength(2);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("QUOTED");
    expect(await thread(r.id)).toHaveLength(before.length);
    // Ordre inversé côté demande : le support reste en tête, rien ne change.
    const swapped = await set(r.id, [lanyard(), badge()]);
    expect(swapped.revised).toBe(false);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("QUOTED");
  });

  it("DRAFT : retirer un produit reste un changement effectif", async () => {
    const r = await requestWithBadges("DRAFT");
    await set(r.id, [badge(), lanyard()]);
    const res = await set(r.id, [badge()]);
    expect(res.lines).toHaveLength(1);
  });

  it("choices rouvertes : une valeur archivée depuis est retirée quand seule la quantité change", async () => {
    const r = await requestWithBadges("SUBMITTED");
    const option = await prisma.printProductOption.create({
      data: {
        productId: fx.lanyard.id, name: "Couleur", type: "CHOICE", required: false, priceDelta: 0, position: 0,
        values: { create: [{ label: "Rouge", priceDelta: 0, position: 0 }, { label: "Bleu", priceDelta: 0, position: 1 }] },
      },
      include: { values: true },
    });
    const [red, blue] = option.values;
    await set(r.id, [badge(), lanyard({ quantity: 4, choices: [{ optionId: option.id, valueIds: [red.id] }] })]);
    await prisma.printProductOptionValue.update({ where: { id: red.id }, data: { archived: true } });
    const res = await set(r.id, [badge(), lanyard({ quantity: 6, choices: [{ optionId: option.id, valueIds: [red.id] }] })]);
    expect(res.lines[1]).toMatchObject({ quantity: 6, choices: [], optionsSnapshot: [] });
    // Des choix modifiés, eux, sont validés tels quels.
    const err = await reject(set(r.id, [badge(), lanyard({ quantity: 6, choices: [{ optionId: option.id, valueIds: [red.id] }] })]));
    expect(err).toMatchObject({ code: "INVALID_CHOICES", details: { code: "VALUE_ARCHIVED" } });
    const ok = await set(r.id, [badge(), lanyard({ quantity: 6, choices: [{ optionId: option.id, valueIds: [blue.id] }] })]);
    expect(ok.lines[1].choices).toEqual([{ optionId: option.id, valueIds: [blue.id] }]);
  });
});

describe("setOrganizerProducts — lignes fixées par le staff", () => {
  async function touched(over: { priceOverridden?: boolean; quantityOverridden?: boolean }) {
    const r = await requestWithBadges("SUBMITTED");
    await set(r.id, [badge(), lanyard({ quantity: 5 })]);
    await prisma.printQuoteLine.updateMany({
      where: { requestId: r.id, label: "Cordon" },
      data: over,
    });
    return r;
  }

  it.each([{ priceOverridden: true }, { quantityOverridden: true }])(
    "ligne retouchée (%o) : quantité changée -> LINE_LOCKED_BY_STAFF, retrait permis",
    async (over) => {
      const r = await touched(over);
      expect(await reject(set(r.id, [badge(), lanyard({ quantity: 9 })]))).toMatchObject({
        code: "LINE_LOCKED_BY_STAFF", status: 409, details: { productId: fx.lanyard.id },
      });
      // Rien n'a été écrit (transaction annulée).
      expect((await lines(r.id)).find((l) => l.label === "Cordon")?.quantity).toBe(5);
      const res = await set(r.id, [badge()]);
      expect(res.lines.map((l) => l.label)).toEqual(["Support badge PVC"]);
    },
  );

  it("ligne retouchée : choix changés -> LINE_LOCKED_BY_STAFF ; renvoi à l'identique -> inchangée", async () => {
    const r = await touched({ priceOverridden: true });
    expect(await reject(set(r.id, [badge(), lanyard({ quantity: 5, choices: [{ optionId: "x", text: "y" }] })]))).toMatchObject({ code: "LINE_LOCKED_BY_STAFF" });
    const res = await set(r.id, [badge(), lanyard({ quantity: 5 })]);
    expect(res.lines).toHaveLength(2);
  });

  it("quantité non saisie sur une ligne fixée : conservée, pas de conflit", async () => {
    const r = await touched({ quantityOverridden: true });
    const res = await set(r.id, [badge(), lanyard()]);
    expect(res.lines[1].quantity).toBe(5);
  });

  it("support fixé par le staff : sa quantité n'est pas recalculée", async () => {
    const r = await requestWithBadges("SUBMITTED");
    await set(r.id, [badge()]);
    await prisma.printQuoteLine.updateMany({ where: { requestId: r.id }, data: { quantityOverridden: true, quantity: 4, lineTotal: 6000 } });
    const res = await set(r.id, [badge(), lanyard()]);
    expect(res.lines[0].quantity).toBe(4);
  });
});

describe("setOrganizerProducts — correctifs de relecture", () => {
  const addBadge = async (requestId: string, index: number) =>
    prisma.printRequestItem.create({
      data: { requestId, registrationId: fx.approved[index].id, position: index },
    });

  it.each([
    ["support", () => [badge(), lanyard({ quantity: 5 })]],
    ["accessoire sans quantité", () => [badge(), lanyard()]],
  ])("prix fixé seul, quantité dérivée (%s) : le changement du nombre de badges ne verrouille pas", async (_n, build) => {
    const r = await requestWithBadges("SUBMITTED", 2);
    await set(r.id, build());
    await prisma.printQuoteLine.updateMany({ where: { requestId: r.id }, data: { priceOverridden: true } });
    await addBadge(r.id, 2);
    const res = await set(r.id, build());
    expect(res.lines.map((l) => l.quantity)).toEqual([2, build()[1].quantity ?? 2]);
    expect(res.revised).toBe(false);
  });

  it("choix équivalents (valueIds vide) : ni verrou ni nouveau prix", async () => {
    const r = await requestWithBadges("SUBMITTED");
    const option = await prisma.printProductOption.create({
      data: { productId: fx.lanyard.id, name: "Couleur", type: "CHOICE", required: false, priceDelta: 0, position: 0 },
    });
    await set(r.id, [badge(), lanyard({ quantity: 5 })]);
    await prisma.printQuoteLine.updateMany({ where: { requestId: r.id }, data: { priceOverridden: true, unitPrice: 123, lineTotal: 615 } });
    const before = (await thread(r.id)).length;
    const res = await set(r.id, [badge(), lanyard({ quantity: 5, choices: [{ optionId: option.id, valueIds: [] }] })]);
    expect(res.lines[1]).toMatchObject({ unitPrice: 123, lineTotal: 615 });
    expect(await thread(r.id)).toHaveLength(before);
  });

  it("n'enregistre que le champ pertinent de chaque option", async () => {
    const r = await requestWithBadges("SUBMITTED");
    const text = await prisma.printProductOption.create({
      data: { productId: fx.lanyard.id, name: "Texte", type: "TEXT", required: false, priceDelta: 0, position: 0, maxLength: 20 },
    });
    const choice = await prisma.printProductOption.create({
      data: {
        productId: fx.lanyard.id, name: "Couleur", type: "CHOICE", required: false, priceDelta: 0, position: 1,
        values: { create: [{ label: "Rouge", priceDelta: 0, position: 0 }] },
      },
      include: { values: true },
    });
    const res = await set(r.id, [badge(), lanyard({
      choices: [
        { optionId: text.id, text: "Forum", valueIds: ["zz"] },
        { optionId: choice.id, valueIds: [choice.values[0].id], text: "parasite" },
      ],
    })]);
    expect(res.lines[1].choices).toEqual([
      { optionId: text.id, text: "Forum" },
      { optionId: choice.id, valueIds: [choice.values[0].id] },
    ]);
  });

  it("choix vides de chaque type (texte, fichier, répartition) retirés ; option inconnue refusée", async () => {
    const r = await requestWithBadges("SUBMITTED");
    const mk = (type: "TEXT" | "FILE" | "QUANTITY_SPLIT", position: number) =>
      prisma.printProductOption.create({
        data: { productId: fx.lanyard.id, name: type, type, required: false, priceDelta: 0, position },
      });
    const [t, f, q] = [await mk("TEXT", 0), await mk("FILE", 1), await mk("QUANTITY_SPLIT", 2)];
    const res = await set(r.id, [badge(), lanyard({
      choices: [{ optionId: t.id, text: "  " }, { optionId: t.id }, { optionId: f.id }, { optionId: q.id, split: [] }, { optionId: q.id }],
    })]).then((x) => x, (e) => e as PrintRequestError);
    // Les doublons d'option restent détectés après normalisation : ici tous sont vides, donc retirés.
    expect((res as { lines: { choices: unknown }[] }).lines[1].choices).toEqual([]);
  });

  it("montant d'une ligne ou total au-delà de 2 000 000 000 -> VALIDATION", async () => {
    const r = await requestWithBadges("SUBMITTED");
    await prisma.printProduct.update({ where: { id: fx.lanyard.id }, data: { basePrice: 1_000_000_000 } });
    expect(await reject(set(r.id, [badge(), lanyard()]))).toMatchObject({ code: "VALIDATION", status: 400 });
    // Chaque ligne passe (1,8 Md et 0,6 Md), mais pas leur somme.
    await prisma.printProduct.update({ where: { id: fx.lanyard.id }, data: { basePrice: 200_000_000 } });
    await prisma.printProduct.update({ where: { id: fx.badgeProduct.id }, data: { basePrice: 600_000_000 } });
    expect(await reject(set(r.id, [badge(), lanyard()]))).toMatchObject({ code: "VALIDATION" });
    expect(await lines(r.id)).toHaveLength(0);
  });

  it("paliers : 3 badges et 8 accessoires n'ont pas le même palier", async () => {
    const r = await requestWithBadges("SUBMITTED");
    await prisma.printProductPriceTier.create({ data: { productId: fx.lanyard.id, minQuantity: 5, unitPrice: 400 } });
    const res = await set(r.id, [badge(), lanyard(), ]);
    expect(res.lines[1].unitPrice).toBe(500);
    const res2 = await set(r.id, [badge(), lanyard({ quantity: 8 })]);
    expect(res2.lines[1]).toMatchObject({ unitPrice: 400, lineTotal: 3200 });
  });

  it("ligne modifiée dont le produit a été archivé -> PRODUCT_UNAVAILABLE", async () => {
    const r = await requestWithBadges("SUBMITTED");
    await set(r.id, [badge(), lanyard({ quantity: 5 })]);
    await prisma.printProduct.update({ where: { id: fx.lanyard.id }, data: { archived: true } });
    expect(await reject(set(r.id, [badge(), lanyard({ quantity: 6 })]))).toMatchObject({
      code: "PRODUCT_UNAVAILABLE", details: { productId: fx.lanyard.id },
    });
  });

  it("répartition : changer la quantité sans refaire la répartition -> SPLIT_MISMATCH", async () => {
    const r = await requestWithBadges("SUBMITTED");
    const option = await prisma.printProductOption.create({
      data: {
        productId: fx.lanyard.id, name: "Répartition", type: "QUANTITY_SPLIT", required: false, priceDelta: 0, position: 0,
        values: { create: [{ label: "Rouge", priceDelta: 0, position: 0 }] },
      },
      include: { values: true },
    });
    const choices = [{ optionId: option.id, split: [{ valueId: option.values[0].id, quantity: 4 }] }];
    await set(r.id, [badge(), lanyard({ quantity: 4, choices })]);
    expect(await reject(set(r.id, [badge(), lanyard({ quantity: 6, choices })]))).toMatchObject({
      code: "INVALID_CHOICES", details: { code: "SPLIT_MISMATCH" },
    });
  });

  it("prix et total fournis par le client ignorés", async () => {
    const r = await requestWithBadges();
    const res = await set(r.id, [badge(), { ...lanyard(), unitPrice: 1, lineTotal: 1 } as never]);
    expect(res.lines[1]).toMatchObject({ unitPrice: 500, lineTotal: 1500 });
  });

  it("une ligne du staff sur le même produit reste intacte", async () => {
    const r = await requestWithBadges("SUBMITTED");
    const staff = await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "PRODUCT", productId: fx.lanyard.id, label: "Cordon staff",
        quantity: 7, unitPrice: 300, lineTotal: 2100, position: 9, addedBy: "STAFF",
      },
    });
    const res = await set(r.id, [badge(), lanyard()]);
    expect(res.lines.map((l) => l.label)).toEqual(["Support badge PVC", "Cordon", "Cordon staff"]);
    expect(await prisma.printQuoteLine.findUniqueOrThrow({ where: { id: staff.id } })).toMatchObject({
      quantity: 7, unitPrice: 300, removedAt: null,
    });
  });
});

describe("setOrganizerProducts — réordonnancement seul", () => {
  it("QUOTED : seules les positions changent -> reste QUOTED, positions écrites, aucune entrée", async () => {
    const r = await requestWithBadges("SUBMITTED");
    const a = await prisma.printProduct.create({
      data: { kind: "ACCESSORY", name: "Stylo", slug: `stylo2-${Date.now()}`, basePrice: 100, published: true },
    });
    await set(r.id, [badge(), lanyard(), lanyard({ productId: a.id })]);
    await prisma.printRequest.update({ where: { id: r.id }, data: { status: "QUOTED" } });
    const before = (await thread(r.id)).length;
    const res = await set(r.id, [badge(), lanyard({ productId: a.id }), lanyard()]);
    expect(res.revised).toBe(false);
    expect(res.lines.map((l) => l.label)).toEqual(["Support badge PVC", "Stylo", "Cordon"]);
    expect((await prisma.printRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("QUOTED");
    expect(await thread(r.id)).toHaveLength(before);
  });

  it("réordonnancement et modification ensemble : positions et quantité écrites", async () => {
    const r = await requestWithBadges("SUBMITTED");
    const a = await prisma.printProduct.create({
      data: { kind: "ACCESSORY", name: "Stylo", slug: `stylo3-${Date.now()}`, basePrice: 100, published: true },
    });
    await set(r.id, [badge(), lanyard(), lanyard({ productId: a.id })]);
    const res = await set(r.id, [badge(), lanyard({ productId: a.id }), lanyard({ quantity: 7 })]);
    expect(res.lines.map((l) => [l.label, l.quantity, l.position])).toEqual([
      ["Support badge PVC", 3, 0], ["Stylo", 3, 1], ["Cordon", 7, 2],
    ]);
  });

  it("statut verrouillé : même un envoi sans effet est refusé", async () => {
    const r = await requestWithBadges("PAID");
    expect(await reject(set(r.id, [badge()]))).toMatchObject({ code: "REQUEST_LOCKED" });
  });
});
