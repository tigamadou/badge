import { describe, expect, it } from "vitest";
import { SOURCE_KINDS, suggestBindings, validateBindings } from "../bindings";
import type { VariableDeclaration } from "@tigamadou/pdf-engine";

const variables: VariableDeclaration[] = [
  { name: "prenom", kind: "text", label: "Prenom" },
  { name: "photo", kind: "image", label: "Photo" },
  { name: "estAnonyme", kind: "boolean", label: "Anonyme" },
];

describe("SOURCE_KINDS", () => {
  it("expose les sources du domaine badge", () => {
    expect(Object.keys(SOURCE_KINDS)).toHaveLength(17);
    expect(SOURCE_KINDS["event.securityInstructions"]).toBe("list");
    expect(SOURCE_KINDS["participant.firstName"]).toBe("text");
    expect(SOURCE_KINDS["category.color"]).toBe("color");
    expect(SOURCE_KINDS["event.date"]).toBe("date");
    expect(SOURCE_KINDS["badge.qrCodeDataUrl"]).toBe("image");
    expect(SOURCE_KINDS["badge.allAccess"]).toBe("boolean");
  });
});

describe("validateBindings", () => {
  it("accepte une table complete et bien typee", () => {
    expect(
      validateBindings(variables, {
        prenom: "participant.firstName",
        photo: "participant.photoDataUrl",
        estAnonyme: "category.anonymous",
      }),
    ).toEqual([]);
  });

  it("accepte une variable explicitement laissee vide", () => {
    expect(
      validateBindings(variables, {
        prenom: "participant.firstName",
        photo: null,
        estAnonyme: "category.anonymous",
      }),
    ).toEqual([]);
  });

  it("refuse une variable dont la liaison n'a pas ete decidee", () => {
    const errors = validateBindings(variables, { prenom: "participant.firstName" });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("photo");
    expect(errors[0]).toContain("aucune source choisie");
  });

  it("refuse une source inconnue", () => {
    const errors = validateBindings(variables, {
      prenom: "participant.nickname",
      photo: null,
      estAnonyme: null,
    });
    expect(errors).toEqual([
      'variable "prenom" : source inconnue "participant.nickname".',
    ]);
  });

  it("refuse une source dont le type ne correspond pas", () => {
    const errors = validateBindings(variables, {
      prenom: "participant.firstName",
      photo: "participant.firstName",
      estAnonyme: null,
    });
    expect(errors).toEqual([
      'variable "photo" (image) : la source "participant.firstName" est de type text.',
    ]);
  });

  it("signale une liaison qui ne correspond a aucune variable declaree", () => {
    const errors = validateBindings(variables, {
      prenom: "participant.firstName",
      photo: null,
      estAnonyme: null,
      fantome: "event.title",
    });
    expect(errors).toEqual(['liaison "fantome" : aucune variable de ce nom.']);
  });

  it.each(["constructor", "toString", "valueOf"])(
    "ne tient pas pour decidee une variable nommee %s via le prototype",
    (name) => {
      const errors = validateBindings([{ name, kind: "text", label: name }], {});
      expect(errors).toEqual([`variable "${name}" : aucune source choisie.`]);
    },
  );

  it("refuse comme inconnue une source qui n'existe que sur le prototype", () => {
    const errors = validateBindings([{ name: "prenom", kind: "text", label: "Prenom" }], {
      prenom: "toString",
    });
    expect(errors).toEqual(['variable "prenom" : source inconnue "toString".']);
  });
});

describe("suggestBindings", () => {
  it("propose l'identite quand le nom est une source du meme type", () => {
    const declared: VariableDeclaration[] = [
      { name: "participant.firstName", kind: "text", label: "Prenom" },
      { name: "event.date", kind: "date", label: "Date" },
    ];
    expect(suggestBindings(declared)).toEqual({
      "participant.firstName": "participant.firstName",
      "event.date": "event.date",
    });
  });

  it("ne propose rien pour un nom libre", () => {
    expect(suggestBindings(variables)).toEqual({});
  });

  it("ne propose rien quand le nom correspond mais pas le type", () => {
    const declared: VariableDeclaration[] = [
      { name: "participant.firstName", kind: "image", label: "Prenom" },
    ];
    expect(suggestBindings(declared)).toEqual({});
  });
});
