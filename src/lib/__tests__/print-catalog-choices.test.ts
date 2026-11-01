import { describe, it, expect } from "vitest";
import {
  validateChoices, snapshotChoices, choiceErrorMessage, defaultConfiguration,
  unitPriceFor, tierPriceFor,
  type ChoiceErrorCode, type CatalogProduct, type OptionChoice, type PricingOption,
} from "@/lib/print-catalog/pricing-core";
import { CORDON, v } from "./helpers/print-products";

const COLOR: OptionChoice = { optionId: "o-color", valueIds: ["or"] };
const TEXT: OptionChoice = { optionId: "o-text", text: "Forum 2026" };

function withOption(opt: PricingOption, extra: Partial<CatalogProduct> = {}): CatalogProduct {
  return { ...CORDON, ...extra, options: [...CORDON.options, opt] };
}
const fileOpt: PricingOption = {
  id: "o-file", name: "Logo", help: null, type: "FILE", required: false, priceDelta: 200,
  maxLength: null, archived: false, values: [],
};
const splitOpt: PricingOption = {
  id: "o-split", name: "Répartition", help: null, type: "QUANTITY_SPLIT", required: false,
  priceDelta: 0, maxLength: null, archived: false,
  values: [v("rouge", "Rouge", null, 0), v("or", "Or", null, 100)],
};
const multiOpt: PricingOption = {
  id: "o-multi", name: "Finitions", help: null, type: "MULTI_CHOICE", required: false,
  priceDelta: 0, maxLength: null, archived: false,
  values: [v("a", "A", null, 10), v("b", "B", null, 20)],
};

describe("validateChoices", () => {
  it("cordon x100, Or + texte : ok", () => {
    expect(validateChoices(CORDON, [COLOR, TEXT], 100)).toEqual({ ok: true });
  });
  it("produit archivé ou brouillon -> PRODUCT_UNAVAILABLE", () => {
    expect(validateChoices({ ...CORDON, archived: true }, [COLOR], 100)).toEqual({ ok: false, code: "PRODUCT_UNAVAILABLE" });
    expect(validateChoices({ ...CORDON, published: false }, [COLOR], 100)).toEqual({ ok: false, code: "PRODUCT_UNAVAILABLE" });
  });
  it("x49 pour un minimum de 50 -> QUANTITY_BELOW_MINIMUM", () => {
    expect(validateChoices(CORDON, [COLOR], 49)).toEqual({ ok: false, code: "QUANTITY_BELOW_MINIMUM" });
  });
  it("couleur absente -> REQUIRED_OPTION_MISSING, optionId o-color", () => {
    expect(validateChoices(CORDON, [], 100)).toEqual({ ok: false, code: "REQUIRED_OPTION_MISSING", optionId: "o-color" });
  });
  it("couleur avec valueIds [] -> REQUIRED_OPTION_MISSING (choix vide)", () => {
    expect(validateChoices(CORDON, [{ optionId: "o-color", valueIds: [] }], 100))
      .toEqual({ ok: false, code: "REQUIRED_OPTION_MISSING", optionId: "o-color" });
  });
  it("option inconnue -> UNKNOWN_OPTION ; option archivée -> OPTION_ARCHIVED", () => {
    expect(validateChoices(CORDON, [COLOR, { optionId: "zzz", text: "x" }], 100))
      .toEqual({ ok: false, code: "UNKNOWN_OPTION", optionId: "zzz" });
    const p = { ...CORDON, options: CORDON.options.map((o) => (o.id === "o-text" ? { ...o, archived: true } : o)) };
    expect(validateChoices(p, [COLOR, TEXT], 100)).toEqual({ ok: false, code: "OPTION_ARCHIVED", optionId: "o-text" });
  });
  it("même option deux fois -> DUPLICATE_OPTION", () => {
    expect(validateChoices(CORDON, [COLOR, COLOR], 100)).toEqual({ ok: false, code: "DUPLICATE_OPTION", optionId: "o-color" });
  });
  it("valeur inconnue -> UNKNOWN_VALUE ; valeur archivée -> VALUE_ARCHIVED", () => {
    expect(validateChoices(CORDON, [{ optionId: "o-color", valueIds: ["vert"] }], 100))
      .toEqual({ ok: false, code: "UNKNOWN_VALUE", optionId: "o-color" });
    const p = {
      ...CORDON,
      options: CORDON.options.map((o) =>
        o.id === "o-color" ? { ...o, values: o.values.map((x) => (x.id === "or" ? { ...x, archived: true } : x)) } : o),
    };
    expect(validateChoices(p, [COLOR], 100)).toEqual({ ok: false, code: "VALUE_ARCHIVED", optionId: "o-color" });
  });
  it("deux couleurs -> TOO_MANY_VALUES ; MULTI_CHOICE à deux valeurs -> ok", () => {
    expect(validateChoices(CORDON, [{ optionId: "o-color", valueIds: ["or", "rouge"] }], 100))
      .toEqual({ ok: false, code: "TOO_MANY_VALUES", optionId: "o-color" });
    expect(validateChoices(withOption(multiOpt), [COLOR, { optionId: "o-multi", valueIds: ["a", "b"] }], 100)).toEqual({ ok: true });
  });
  it("texte de 31 caractères -> TEXT_TOO_LONG ; 30 -> ok", () => {
    expect(validateChoices(CORDON, [COLOR, { optionId: "o-text", text: "x".repeat(31) }], 100))
      .toEqual({ ok: false, code: "TEXT_TOO_LONG", optionId: "o-text" });
    expect(validateChoices(CORDON, [COLOR, { optionId: "o-text", text: "x".repeat(30) }], 100)).toEqual({ ok: true });
  });
  it("fileKey invalide -> INVALID_FILE ; print-requests/ -> ok", () => {
    const p = withOption(fileOpt);
    expect(validateChoices(p, [COLOR, { optionId: "o-file", fileKey: "orgs/x/images/a.png" }], 100))
      .toEqual({ ok: false, code: "INVALID_FILE", optionId: "o-file" });
    expect(validateChoices(p, [COLOR, { optionId: "o-file", fileKey: "print-requests/e1/a.pdf" }], 100)).toEqual({ ok: true });
  });
  it("split 120 + 79 pour 200 -> SPLIT_MISMATCH ; part 0 ; valeur répétée ; part non entière ; valeur inconnue", () => {
    const p = withOption(splitOpt);
    const run = (split: { valueId: string; quantity: number }[]) =>
      validateChoices(p, [COLOR, { optionId: "o-split", split }], 200);
    const bad = { ok: false, code: "SPLIT_MISMATCH", optionId: "o-split" };
    expect(run([{ valueId: "rouge", quantity: 120 }, { valueId: "or", quantity: 79 }])).toEqual(bad);
    expect(run([{ valueId: "rouge", quantity: 200 }, { valueId: "or", quantity: 0 }])).toEqual(bad);
    expect(run([{ valueId: "rouge", quantity: 100 }, { valueId: "rouge", quantity: 100 }])).toEqual(bad);
    expect(run([{ valueId: "rouge", quantity: 100.5 }, { valueId: "or", quantity: 99.5 }])).toEqual(bad);
    expect(run([{ valueId: "rouge", quantity: 120 }, { valueId: "or", quantity: 80 }])).toEqual({ ok: true });
    expect(run([{ valueId: "nope", quantity: 200 }])).toEqual({ ok: false, code: "UNKNOWN_VALUE", optionId: "o-split" });
  });
  it("choix vide d'une option facultative (texte blanc, split []) compte comme absent", () => {
    const p = withOption(splitOpt);
    expect(validateChoices(p, [COLOR, { optionId: "o-text", text: "  " }, { optionId: "o-split", split: [] }], 100)).toEqual({ ok: true });
  });
  it("option requise archivée sans choix : ok", () => {
    const p = { ...CORDON, options: CORDON.options.map((o) => (o.id === "o-color" ? { ...o, archived: true } : o)) };
    expect(validateChoices(p, [], 100)).toEqual({ ok: true });
  });
});

describe("durcissement", () => {
  it("valeur en double -> TOO_MANY_VALUES", () => {
    expect(validateChoices(withOption(multiOpt), [COLOR, { optionId: "o-multi", valueIds: ["a", "a"] }], 100))
      .toEqual({ ok: false, code: "TOO_MANY_VALUES", optionId: "o-multi" });
  });
  it("quantité non entière ou non finie -> QUANTITY_BELOW_MINIMUM", () => {
    for (const q of [NaN, 100.5, Infinity]) {
      expect(validateChoices(CORDON, [COLOR], q)).toEqual({ ok: false, code: "QUANTITY_BELOW_MINIMUM" });
    }
  });
  it("clé de fichier avec .. ou // -> INVALID_FILE", () => {
    const p = withOption(fileOpt);
    for (const fileKey of ["print-requests/../orgs/x/a.png", "print-requests//a.pdf"]) {
      expect(validateChoices(p, [COLOR, { optionId: "o-file", fileKey }], 100))
        .toEqual({ ok: false, code: "INVALID_FILE", optionId: "o-file" });
    }
  });
});

describe("snapshotChoices", () => {
  it("x100, Or + texte", () => {
    expect(snapshotChoices(CORDON, [COLOR, TEXT], 100)).toEqual([
      { optionName: "Couleur", type: "COLOR", labels: ["Or"], priceDelta: 100 },
      { optionName: "Texte imprimé", type: "TEXT", labels: [], text: "Forum 2026", priceDelta: 150 },
    ]);
  });
  it("ordre des options du produit, choix vides ignorés, fichier", () => {
    const p = withOption(fileOpt);
    const snap = snapshotChoices(p, [
      { optionId: "o-file", fileKey: "print-requests/e1/a.pdf" },
      { optionId: "o-text", text: " " },
      COLOR,
    ], 100);
    expect(snap).toEqual([
      { optionName: "Couleur", type: "COLOR", labels: ["Or"], priceDelta: 100 },
      { optionName: "Logo", type: "FILE", labels: [], fileKey: "print-requests/e1/a.pdf", priceDelta: 200 },
    ]);
  });
  it("QUANTITY_SPLIT x200 : split libellé, priceDelta 40", () => {
    const p = withOption(splitOpt);
    const snap = snapshotChoices(p, [COLOR, {
      optionId: "o-split",
      split: [{ valueId: "rouge", quantity: 120 }, { valueId: "or", quantity: 80 }],
    }], 200);
    expect(snap[1]).toEqual({
      optionName: "Répartition", type: "QUANTITY_SPLIT", labels: [],
      split: [{ label: "Rouge", quantity: 120 }, { label: "Or", quantity: 80 }], priceDelta: 40,
    });
  });
  it("invariant : tierPriceFor + Σ priceDelta = unitPriceFor (x3 avec répartition arrondie)", () => {
    const p = withOption(splitOpt, { minQuantity: 1 });
    const choices: OptionChoice[] = [COLOR, TEXT, {
      optionId: "o-split", split: [{ valueId: "rouge", quantity: 2 }, { valueId: "or", quantity: 1 }],
    }];
    const sum = snapshotChoices(p, choices, 3).reduce((s, c) => s + c.priceDelta, 0);
    expect(tierPriceFor(p, 3) + sum).toBe(unitPriceFor(p, 3, choices));
    expect(unitPriceFor(p, 3, choices)).toBe(500 + 100 + 150 + 33);
  });
  it("la copie figée ne bouge pas quand le produit change ensuite", () => {
    const p: CatalogProduct = JSON.parse(JSON.stringify(CORDON));
    const snap = snapshotChoices(p, [COLOR], 100);
    const or = p.options[0].values.find((x) => x.id === "or")!;
    or.label = "Doré";
    or.priceDelta = 200;
    expect(snap).toEqual([{ optionName: "Couleur", type: "COLOR", labels: ["Or"], priceDelta: 100 }]);
  });
});

describe("types et champs absents", () => {
  const choiceOpt: PricingOption = {
    id: "o-ch", name: "Taille", help: null, type: "CHOICE", required: true, priceDelta: 0,
    maxLength: null, archived: false, values: [v("s", "S", null, 5), v("l", "L", null, 10)],
  };
  it("CHOICE : validation, snapshot, défaut", () => {
    const p = withOption(choiceOpt);
    const good: OptionChoice[] = [COLOR, { optionId: "o-ch", valueIds: ["l"] }];
    expect(validateChoices(p, good, 100)).toEqual({ ok: true });
    expect(validateChoices(p, [COLOR, { optionId: "o-ch", valueIds: ["s", "l"] }], 100))
      .toEqual({ ok: false, code: "TOO_MANY_VALUES", optionId: "o-ch" });
    expect(snapshotChoices(p, good, 100)[1]).toEqual({ optionName: "Taille", type: "CHOICE", labels: ["L"], priceDelta: 10 });
    expect(unitPriceFor(p, 100, good)).toBe(450 + 100 + 10);
    expect(defaultConfiguration(p).choices).toEqual([
      { optionId: "o-color", valueIds: ["rouge"] }, { optionId: "o-ch", valueIds: ["s"] },
    ]);
  });
  it("champs absents = choix vides", () => {
    const p = withOption(fileOpt);
    const q = withOption(splitOpt);
    expect(validateChoices(CORDON, [{ optionId: "o-color" }], 100))
      .toEqual({ ok: false, code: "REQUIRED_OPTION_MISSING", optionId: "o-color" });
    expect(validateChoices(CORDON, [COLOR, { optionId: "o-text" }], 100)).toEqual({ ok: true });
    expect(validateChoices(p, [COLOR, { optionId: "o-file" }], 100)).toEqual({ ok: true });
    expect(validateChoices(q, [COLOR, { optionId: "o-split" }], 100)).toEqual({ ok: true });
  });
  it("snapshot d'une valeur inconnue : repli sur l'identifiant", () => {
    expect(snapshotChoices(CORDON, [{ optionId: "o-color", valueIds: ["zzz"] }], 100)[0].labels).toEqual(["zzz"]);
  });
  it("défaut : ignore une option requise d'un autre type", () => {
    const req: PricingOption = { ...fileOpt, id: "o-req", required: true };
    expect(defaultConfiguration(withOption(req)).choices).toEqual([{ optionId: "o-color", valueIds: ["rouge"] }]);
  });
});

describe("choiceErrorMessage", () => {
  it("un message français non vide pour chacun des 12 codes", () => {
    const codes: ChoiceErrorCode[] = [
      "PRODUCT_UNAVAILABLE", "QUANTITY_BELOW_MINIMUM", "UNKNOWN_OPTION", "OPTION_ARCHIVED",
      "DUPLICATE_OPTION", "REQUIRED_OPTION_MISSING", "UNKNOWN_VALUE", "VALUE_ARCHIVED",
      "TOO_MANY_VALUES", "TEXT_TOO_LONG", "INVALID_FILE", "SPLIT_MISMATCH",
    ];
    for (const c of codes) expect(choiceErrorMessage(c).length).toBeGreaterThan(5);
    expect(new Set(codes.map(choiceErrorMessage)).size).toBe(12);
    expect(choiceErrorMessage("REQUIRED_OPTION_MISSING")).toBe("Choisissez une valeur pour chaque option obligatoire.");
  });
});

describe("defaultConfiguration", () => {
  it("CORDON = quantité 50 et couleur rouge", () => {
    expect(defaultConfiguration(CORDON)).toEqual({ quantity: 50, choices: [{ optionId: "o-color", valueIds: ["rouge"] }] });
  });
  it("saute les valeurs et options archivées, ignore les options non requises", () => {
    const p = {
      ...CORDON,
      options: CORDON.options.map((o) =>
        o.id === "o-color" ? { ...o, values: o.values.map((x) => (x.id === "rouge" ? { ...x, archived: true } : x)) } : o),
    };
    expect(defaultConfiguration(p).choices).toEqual([{ optionId: "o-color", valueIds: ["bleu"] }]);
    const q = { ...CORDON, options: CORDON.options.map((o) => (o.id === "o-color" ? { ...o, archived: true } : o)) };
    expect(defaultConfiguration(q).choices).toEqual([]);
    const r = { ...CORDON, options: CORDON.options.map((o) => (o.id === "o-color" ? { ...o, values: [] } : o)) };
    expect(defaultConfiguration(r).choices).toEqual([]);
  });
});
