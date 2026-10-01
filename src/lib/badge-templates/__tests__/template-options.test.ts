import { describe, it, expect } from "vitest";
import type { VariableDeclaration } from "@tigamadou/pdf-engine";
import {
  effectiveOption,
  isValidOptionValue,
  mergeTemplateOptions,
  normalizeEditedOptions,
  optionVariables,
  readTemplateOptions,
  templateOptionsSchema,
} from "../template-options";

const v = (name: string, kind: VariableDeclaration["kind"], sample?: unknown): VariableDeclaration =>
  ({ name, kind, label: name, ...(sample !== undefined ? { sample } : {}) }) as VariableDeclaration;

describe("readTemplateOptions", () => {
  it("rend un objet, ou {} pour toute autre valeur", () => {
    expect(readTemplateOptions({ a: true })).toEqual({ a: true });
    expect(readTemplateOptions(null)).toEqual({});
    expect(readTemplateOptions([true])).toEqual({});
    expect(readTemplateOptions("x")).toEqual({});
  });
});

describe("optionVariables", () => {
  it("garde les variables liees a option", () => {
    const variables = [v("participant.firstName", "text"), v("showColorBar", "boolean")];
    expect(
      optionVariables(variables, { "participant.firstName": "participant.firstName", showColorBar: "option" }),
    ).toEqual([variables[1]]);
  });
});

describe("isValidOptionValue", () => {
  it.each([
    ["boolean", true, true],
    ["boolean", "true", false],
    ["text", "Zone C", true],
    ["text", 3, false],
    ["color", "#ff0000", true],
    ["color", "rouge", false],
    ["date", "2026-10-01", true],
    ["date", "01/10/2026", false],
    ["list", ["a", "b"], true],
    ["list", ["a", 1], false],
    ["image", "uploads/org/x.png", true],
    ["image", "", false],
  ] as const)("%s %j -> %s", (kind, value, ok) => {
    expect(isValidOptionValue(kind, value)).toBe(ok);
  });
});

describe("effectiveOption", () => {
  it("rend la valeur reglee du bon type", () => {
    expect(effectiveOption(v("showColorBar", "boolean", true), { showColorBar: false })).toBe(false);
    expect(effectiveOption(v("zone", "text"), { zone: "C" })).toBe("C");
  });

  it("booleen non regle ou de mauvais type : sample, faux sans sample", () => {
    expect(effectiveOption(v("showColorBar", "boolean", true), {})).toBe(true);
    expect(effectiveOption(v("showColorBar", "boolean", true), { showColorBar: "oui" })).toBe(true);
    expect(effectiveOption(v("showQrOnBack", "boolean"), {})).toBe(false);
  });

  it("autre type non regle ou de mauvais type : rien", () => {
    expect(effectiveOption(v("zone", "text", "Company"), {})).toBeUndefined();
    expect(effectiveOption(v("zone", "text"), { zone: true })).toBeUndefined();
  });
});

describe("templateOptionsSchema", () => {
  it("accepte des valeurs bornees", () => {
    expect(templateOptionsSchema.safeParse({ showColorBar: true, zone: "C", lignes: ["a"] }).success).toBe(true);
  });

  it.each([
    ["51 cles", Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, true]))],
    ["cle invalide", { "Zone": true }],
    ["cle trop longue", { [`a${"b".repeat(60)}`]: true }],
    ["prefixe reserve", { "event.banner": "x" }],
    ["chaine trop longue", { zone: "x".repeat(501) }],
    ["liste trop longue", { lignes: Array.from({ length: 31 }, () => "a") }],
    ["element trop long", { lignes: ["x".repeat(501)] }],
    ["type non permis", { zone: 3 }],
  ])("refuse : %s", (_label, value) => {
    expect(templateOptionsSchema.safeParse(value).success).toBe(false);
  });
});

describe("mergeTemplateOptions", () => {
  it("conserve les autres cles, remplace et retire les cles editees", () => {
    expect(
      mergeTemplateOptions({ autreTemplate: "x", showColorBar: true, zone: "A" }, { showColorBar: false, zone: null }),
    ).toEqual({ autreTemplate: "x", showColorBar: false });
  });

  it("ecarte les valeurs stockees qui ne sont pas des OptionValue", () => {
    expect(mergeTemplateOptions({ casse: { a: 1 }, ok: true }, {})).toEqual({ ok: true });
  });
});

describe("normalizeEditedOptions", () => {
  it("retire (null) un booleen egal a son defaut, garde celui qui differe", () => {
    const options = [
      { name: "avecSample", kind: "boolean" as const, sample: true },
      { name: "sansSample", kind: "boolean" as const },
      { name: "decoche", kind: "boolean" as const, sample: true },
      { name: "coche", kind: "boolean" as const },
    ];
    expect(
      normalizeEditedOptions(options, { avecSample: true, sansSample: false, decoche: false, coche: true }),
    ).toEqual({ avecSample: null, sansSample: null, decoche: false, coche: true });
  });

  it("laisse inchanges les options non booleennes", () => {
    const options = [
      { name: "zone", kind: "text" as const },
      { name: "lignes", kind: "list" as const },
      { name: "vide", kind: "text" as const },
    ];
    expect(normalizeEditedOptions(options, { zone: "C", lignes: ["a"], vide: null })).toEqual({
      zone: "C",
      lignes: ["a"],
      vide: null,
    });
  });
});
