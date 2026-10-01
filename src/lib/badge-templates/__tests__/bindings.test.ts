import { describe, expect, it } from "vitest";
import { BADGE_CONTRACT, contractKinds } from "@tigamadou/pdf-engine/contracts";
import {
  checkBadgePackage,
  computeBindings,
  LEGACY_NAMES,
  OPTION_BINDING,
  SOURCE_KINDS,
  validateBindings,
} from "../bindings";
import type { TemplateManifest, VariableDeclaration } from "@tigamadou/pdf-engine";

const variables: VariableDeclaration[] = [
  { name: "prenom", kind: "text", label: "Prenom" },
  { name: "photo", kind: "image", label: "Photo" },
  { name: "estAnonyme", kind: "boolean", label: "Anonyme" },
];

describe("SOURCE_KINDS", () => {
  it("expose les sources du domaine badge", () => {
    expect(Object.keys(SOURCE_KINDS)).toHaveLength(18);
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

const vd = (name: string, kind: VariableDeclaration["kind"]) => ({ name, kind, label: name });

describe("computeBindings", () => {
  it("lie une cle du contrat a elle-meme et le reste en option", () => {
    expect(
      computeBindings([
        vd("participant.firstName", "text"),
        vd("event.bannerDataUrl", "image"),
        vd("showColorBar", "boolean"),
        vd("zone", "text"),
      ]),
    ).toEqual({
      "participant.firstName": "participant.firstName",
      "event.bannerDataUrl": "event.bannerDataUrl",
      showColorBar: OPTION_BINDING,
      zone: OPTION_BINDING,
    });
  });

  it("traite en option une cle du contrat de mauvais type ou un nom du prototype", () => {
    expect(
      computeBindings([vd("participant.firstName", "image"), vd("constructor", "text")]),
    ).toEqual({ "participant.firstName": OPTION_BINDING, constructor: OPTION_BINDING });
  });

  it("produit des liaisons que validateBindings accepte", () => {
    const declared = [vd("participant.firstName", "text"), vd("showColorBar", "boolean")];
    expect(validateBindings(declared, computeBindings(declared))).toEqual([]);
  });
});

describe("checkBadgePackage", () => {
  const manifest = (declared: Array<ReturnType<typeof vd>>) =>
    ({ category: "badge", variables: declared }) as unknown as TemplateManifest;

  it("refuse une categorie autre que badge", () => {
    const autre = { category: "autre", variables: [vd("firstName", "text")] } as unknown as TemplateManifest;
    expect(checkBadgePackage(autre)).toEqual([
      'catégorie "autre" : seuls les templates de badge s\'installent ici.',
    ]);
  });

  it("accepte un paquet conforme", () => {
    expect(
      checkBadgePackage(manifest([vd("participant.firstName", "text"), vd("showColorBar", "boolean")])),
    ).toEqual([]);
  });

  it("refuse un ancien nom avec le nom attendu", () => {
    expect(checkBadgePackage(manifest([vd("firstName", "text")]))).toEqual([
      'variable "firstName" : ancien nom, réexporter le template depuis le studio (attendu "participant.firstName").',
    ]);
  });

  it("refuse une cle hors contrat sous un prefixe reserve", () => {
    expect(checkBadgePackage(manifest([vd("participant.fristName", "text")]))[0]).toContain(
      "préfixe réservé",
    );
  });

  it("couvre les 18 anciens noms", () => {
    expect(Object.keys(LEGACY_NAMES)).toHaveLength(18);
    expect(LEGACY_NAMES.isAnonymous).toBe("category.anonymous");
  });
});

describe("sources issues du contrat", () => {
  it("SOURCE_KINDS est exactement le contrat badge", () => {
    expect(SOURCE_KINDS).toEqual(Object.fromEntries(contractKinds(BADGE_CONTRACT)));
    expect(SOURCE_KINDS["event.bannerDataUrl"]).toBe("image");
  });
});

describe("liaison option", () => {
  const v = (name: string, kind: "text" | "boolean" | "image" | "list" | "color" | "date") => ({
    name,
    kind,
    label: name,
  });

  it("accepte option pour tout type", () => {
    const vars = [
      v("showColorBar", "boolean"),
      v("zone", "text"),
      v("visuel", "image"),
      v("lignes", "list"),
      v("teinte", "color"),
      v("jour", "date"),
    ];
    const bindings = Object.fromEntries(vars.map((x) => [x.name, OPTION_BINDING]));
    expect(validateBindings(vars, bindings)).toEqual([]);
  });

  it("refuse option sur un nom a prefixe reserve", () => {
    expect(
      validateBindings([v("participant.fristName", "text")], { "participant.fristName": OPTION_BINDING }),
    ).toEqual(['variable "participant.fristName" : une option ne peut pas porter le préfixe réservé "participant.".']);
  });
});
